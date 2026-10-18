// Draws a recap card to a PNG so it can be shared or saved. Uses only team colours and text
// (no remote images), so the canvas never gets blocked.
import { skinFromColors } from './util.js';

function wrap(ctx, text, x, y, maxW, lineH, maxLines) {
  const words = String(text).split(/\s+/);
  let line = '', n = 0;
  for (const w of words) {
    const test = line ? line + ' ' + w : w;
    if (ctx.measureText(test).width > maxW && line) {
      ctx.fillText(line, x, y); y += lineH; line = w; n++;
      if (n >= maxLines - 1) break;
    } else line = test;
  }
  if (line) ctx.fillText(line, x, y);
  return y + lineH;
}

export function recapCanvas(recap) {
  const g = recap.game;
  const canvas = document.createElement('canvas');
  const W = 1080, H = 1350;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext && canvas.getContext('2d');
  if (!ctx) return null;
  const winner = (g.home.score ?? 0) >= (g.away.score ?? 0) ? g.home : g.away;
  const sk = skinFromColors(winner.color, winner.alt);
  const grad = ctx.createLinearGradient(0, 0, W, H);
  grad.addColorStop(0, sk.t1); grad.addColorStop(1, sk.t2);
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = sk.tink; ctx.globalAlpha = 0.85;
  ctx.font = '600 34px system-ui, sans-serif'; ctx.fillText('FINAL', 70, 110);
  ctx.globalAlpha = 1;

  ctx.font = '700 150px "Big Shoulders Display", Impact, sans-serif';
  ctx.fillText(`${g.away.abbr} ${g.away.score}`, 70, 290);
  ctx.fillText(`${g.home.abbr} ${g.home.score}`, 70, 440);

  let y = 560;
  if (recap.potg) {
    ctx.fillStyle = sk.tink; ctx.globalAlpha = 0.18; ctx.fillRect(50, y - 60, W - 100, 230); ctx.globalAlpha = 1;
    ctx.fillStyle = sk.tacc; ctx.font = '600 30px system-ui, sans-serif'; ctx.fillText('PLAYER OF THE GAME', 80, y);
    ctx.fillStyle = sk.tink; ctx.font = '700 84px "Big Shoulders Display", Impact, sans-serif';
    ctx.fillText(recap.potg.name.toUpperCase(), 80, y + 90);
    ctx.font = '500 40px system-ui, sans-serif'; ctx.fillText(recap.potg.big, 80, y + 150);
    y += 290;
  }
  ctx.fillStyle = sk.tacc; ctx.font = '600 30px system-ui, sans-serif'; ctx.fillText('THE MOMENTS', 80, y);
  y += 30;
  ctx.fillStyle = sk.tink; ctx.font = '500 38px system-ui, sans-serif';
  for (const m of recap.moments.slice(0, 3)) {
    y += 52; ctx.globalAlpha = 0.8; ctx.fillText(m.when, 80, y); ctx.globalAlpha = 1;
    y = wrap(ctx, m.text, 80, y + 50, W - 160, 48, 2) + 4;
  }
  if (recap.quote) {
    ctx.font = 'italic 500 42px system-ui, sans-serif';
    wrap(ctx, '“' + recap.quote + '”', 80, Math.max(y + 60, 1090), W - 160, 54, 3);
  }
  ctx.globalAlpha = 0.7; ctx.fillStyle = sk.tink; ctx.font = '600 32px system-ui, sans-serif';
  ctx.fillText('Homefield', 70, H - 60);
  return canvas;
}

export async function shareRecap(recap) {
  const canvas = recapCanvas(recap);
  if (!canvas) throw new Error('Your browser cannot draw the image');
  const blob = await new Promise((res) => canvas.toBlob(res, 'image/png'));
  if (!blob) throw new Error('Could not make the image');
  const file = new File([blob], `recap-${recap.game.away.abbr}-${recap.game.home.abbr}.png`, { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: 'Game recap' }); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancelled'; }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 500);
  return 'downloaded';
}
