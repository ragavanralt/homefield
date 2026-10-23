// Early cash out. What an open bet is worth right now, from the live score, the clock and a small model.
//
// How the number is made (all of it can be run with no network, see quoteBet):
//  1. Legs that already finished count as they ended: a won leg keeps its price, a push or void drops out.
//  2. Every other leg gets a chance of winning from a simulation of the rest of its game.
//     Team bets (winner, spread, totals, team totals, overtime, both teams score) share ONE simulated game,
//     so "team A wins" and "over 220" in the same bet move together the way they do in real life.
//     Player props are simulated on their own from the player's stat so far and how much game is left.
//  3. Fair value = the average payout over thousands of simulated finishes. The offer is that, minus a small cut
//     (the same idea as a book's margin), so cashing out is never better than holding on average.
// The model starts from each leg's own price, so it agrees with what the app sold you at placement.
import { LEAGUES, hasDraw } from './leagues.js';
import { gameProgress } from './winprob.js';
import { VIG, propDefsFor, poissonOver, normalOver, streakBoost, evalLeg } from './bets.js';
import { evalSpecial } from './specials.js';
import { playerNow } from './boxread.js';

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const CUT = 0.04; // what the offer takes off fair value
const N = 5000;          // simulated finishes per quote

/* ---------- maths ---------- */
export function normCdf(x) {
  const s = x < 0 ? -1 : 1; const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  return 0.5 * (1 + s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-z * z)));
}
const A = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
const B = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
const C = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
const D = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
export function normInv(p) { // Acklam's approximation
  p = clamp(p, 1e-6, 1 - 1e-6);
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); return (((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1); }
  if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); return -(((((C[0] * q + C[1]) * q + C[2]) * q + C[3]) * q + C[4]) * q + C[5]) / ((((D[0] * q + D[1]) * q + D[2]) * q + D[3]) * q + 1); }
  const q = p - 0.5, r = q * q;
  return (((((A[0] * r + A[1]) * r + A[2]) * r + A[3]) * r + A[4]) * r + A[5]) * q / (((((B[0] * r + B[1]) * r + B[2]) * r + B[3]) * r + B[4]) * r + 1);
}
/** Same seed, same numbers. The offer only moves when the game does. */
export function rngOf(seedText) {
  let a = 2166136261;
  for (let i = 0; i < seedText.length; i++) { a ^= seedText.charCodeAt(i); a = Math.imul(a, 16777619); }
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const gaussOf = (rng) => () => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
function gammaOf(rng, gauss) { // Marsaglia and Tsang, shape >= 1
  return (k) => {
    if (k < 1) { const u = rng(); return gammaOf(rng, gauss)(k + 1) * Math.pow(u, 1 / k); }
    const d = k - 1 / 3, c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x, v;
      do { x = gauss(); v = 1 + c * x; } while (v <= 0);
      v = v * v * v; const u = rng();
      if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  };
}
function poissonOf(rng, gauss) {
  return (l) => {
    if (!(l > 0)) return 0;
    if (l > 30) return Math.max(0, Math.round(l + Math.sqrt(l) * gauss()));
    const L = Math.exp(-l); let k = 0, p = 1;
    do { k++; p *= rng(); } while (p > L);
    return k - 1;
  };
}

/* ---------- how each sport scores ---------- */
// T: usual total for the game. sdM: how far the margin can wander over a whole game once play starts (wider than the miss against a
// pre-game spread, which is what matches how often real leads are blown: up 10 at half wins about 80% in the NBA).
// sdT: spread of the total. od: how much scoring varies beyond chance.
const SPORT = {
  nba: { walk: true, T: 225, sdM: 17, sdT: 17, edge: 2.5, otPts: 11, otWin: 1, reg: 4 },
  nfl: { walk: true, T: 45, sdM: 14.5, sdT: 13, edge: 2.2, otPts: 4, otWin: 3, reg: 4 },
  nhl: { T: 6.0, od: 1.15, odM: 1.1, edge: 0.15, reg: 3 },
  mlb: { T: 8.7, od: 1.3, odM: 2.1, edge: 0.2, reg: 9, cluster: 1.6 }, // runs come in bunches: a scoring inning averages 1.6 runs
  soccer: { T: 2.7, od: 1.2, odM: 1.15, edge: 0.3, reg: 2 },
};
const groupOf = (league) => LEAGUES[league] && LEAGUES[league].group;

/** a leg's own chance when it was priced (the price carries the app's margin, see fromProb) */
const p0Of = (l) => clamp(1 / ((l.dec || 2) * VIG), 0.02, 0.98);

/** Find the average that makes "over this line" as likely as p. Works for counts and for yardage alike. */
function meanFor(dist, cv, line, pOver) {
  let lo = 0.01, hi = Math.max(line * 4, 12);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const p = dist === 'normal' ? normalOver(mid, Math.max(1, mid * cv), line) : poissonOver(mid, line);
    if (p < pOver) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** What we expect of a game before it starts, read back from the prices on this bet: { mT total, mM home margin }. */
export function priorsFor(group, legs) {
  const S = SPORT[group];
  const ts = [], ms = [];
  const tot = legs.filter((l) => l.kind === 'special' && l.sp && l.sp.t === 'total');
  for (const l of tot) { const p0 = p0Of(l), pOver = l.sp.dir === 'over' ? p0 : 1 - p0; ts.push(S.walk ? l.sp.line + S.sdT * normInv(pOver) : meanFor('poisson', 0, l.sp.line, pOver)); }
  const avg = (a, d) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : d);
  const mT = avg(ts, S.T);
  const sdM = S.walk ? S.sdM : Math.sqrt(mT * S.odM); // the same spread the simulation will use, so a fresh game prices back to the same chance
  for (const l of legs) {
    const p0 = p0Of(l);
    if (l.kind === 'ml' && l.side !== 'draw') {
      let pSide = p0;
      if (group === 'soccer') pSide = clamp(p0 / 0.74, 0.05, 0.95); // take the draw out
      ms.push(sdM * normInv(l.side === 'home' ? pSide : 1 - pSide));
    } else if (l.kind === 'special' && l.sp && l.sp.t === 'spread') {
      const sp = l.sp;
      ms.push(sp.side === 'home' ? sdM * normInv(p0) - sp.line : sp.line - sdM * normInv(p0));
    }
  }
  return { mT, mM: avg(ms, S.edge) };
}

/** Where a game is: score, how much is left, and whether it is in overtime. */
export function gameState(game) {
  const group = groupOf(game.league);
  const S = SPORT[group];
  const hs = game.home.score ?? 0, as = game.away.score ?? 0;
  if (game.state === 'pre') return { hs: 0, as: 0, tau: 1, prog: 0, ot: false, state: 'pre' };
  const prog = gameProgress(game);
  const inOT = !!S && ['nba', 'nfl', 'nhl'].includes(group) && (game.period || 0) > S.reg;
  // past the end of regulation the clock reads 100% done; leave a little game to play
  const tau = game.state === 'post' ? 0 : clamp(1 - prog, inOT || prog >= 0.999 ? 0.06 : 0.015, 1);
  return { hs, as, tau, prog, ot: inOT, state: game.state };
}

/** Simulate the rest of one game. Returns { H, A, OT } arrays of N finishes. */
export function simGame(group, st, pri, rng, n = N) {
  const S = SPORT[group];
  const gauss = gaussOf(rng), gamma = gammaOf(rng, gauss), pois = poissonOf(rng, gauss);
  const H = new Int16Array(n), Aw = new Int16Array(n), OT = new Uint8Array(n);
  const tot0 = st.hs + st.as;
  if (S.walk) {
    const sdM = S.sdM, sdT = S.sdT;
    const curRate = st.prog > 0.08 ? tot0 / st.prog : null;
    const w = st.prog / (st.prog + 0.6); // how much to trust this game's pace over the usual one
    const rate = curRate == null ? pri.mT : (1 - w) * pri.mT + w * curRate;
    for (let i = 0; i < n; i++) {
      const M = pri.mM * st.tau + sdM * Math.sqrt(st.tau) * gauss();
      const T = rate * st.tau + sdT * Math.sqrt(st.tau) * gauss();
      const Tr = Math.max(T, Math.abs(M)); // nobody scores a negative number of points: the total left is at least the margin that moves
      let h = st.hs + (Tr + M) / 2, a = st.as + (Tr - M) / 2;
      h = Math.round(h); a = Math.round(a);
      let ot = st.ot ? 1 : 0;
      let guard = 0;
      while (h === a && guard++ < 4) { // overtime
        ot = 1;
        const add = Math.max(1, Math.round(S.otPts / 2 + 2 * gauss()));
        h += add; a += add;
        const homeWins = rng() < clamp(0.5 + pri.mM * 0.015, 0.3, 0.7);
        if (homeWins) h += S.otWin; else a += S.otWin;
        if (S.otWin === 3 && rng() < 0.01) a = h; // football can end level
      }
      H[i] = h; Aw[i] = a; OT[i] = ot;
    }
    return { H, A: Aw, OT };
  }
  // low-scoring sports: goals and runs arrive one at a time
  const lamH = clamp((pri.mT + pri.mM) / 2, 0.12 * pri.mT, 0.88 * pri.mT), lamA = pri.mT - lamH;
  const a0 = pri.mT / Math.max(0.02, S.od - 1);   // how firmly we believe the usual pace
  const expSoFar = pri.mT * st.prog;
  const shape = a0 + tot0, rateG = a0 + expSoFar;
  const per = pri.mT / (2 * SPORT[group].reg || 18);
  // baseball: scoring events arrive one at a time, each worth 1 + a geometric number of extra runs
  const theta = S.cluster ? (S.cluster - 1) / S.cluster : 0;
  const runs = (mean) => { let n = pois(mean / (S.cluster || 1)), r = 0; while (n-- > 0) r += 1 + (theta > 0 ? Math.floor(Math.log(1 - rng()) / Math.log(theta)) : 0); return r; };
  for (let i = 0; i < n; i++) {
    const s = gamma(Math.max(1, shape)) / rateG; // pace of this game, learned from the score so far
    let h, a;
    if (S.cluster) { h = st.hs + runs(lamH * st.tau * s); a = st.as + runs(lamA * st.tau * s); } // baseball
    else { h = st.hs + pois(lamH * st.tau * s); a = st.as + pois(lamA * st.tau * s); }
    let ot = st.ot ? 1 : 0;
    if (h === a && group === 'nhl') { ot = 1; if (rng() < clamp(0.5 + pri.mM * 0.04, 0.35, 0.65)) h++; else a++; }
    if (h === a && group === 'mlb') { // extra innings
      ot = 1;
      for (let k = 0; k < 8 && h === a; k++) { h += S.cluster ? runs(per * s) : pois(per * s); a += S.cluster ? runs(per * s) : pois(per * s); }
      if (h === a) { if (rng() < 0.5) h++; else a++; }
    }
    H[i] = h; Aw[i] = a; OT[i] = ot;
  }
  return { H, A: Aw, OT };
}

/* ---------- one leg against a simulated game ---------- */
// outcomes: 1 won, 0 lost, 2 push or void
function teamOutcomes(l, sim, group, n) {
  const out = new Uint8Array(n);
  const { H, A, OT } = sim;
  const sp = l.sp;
  for (let i = 0; i < n; i++) {
    const h = H[i], a = A[i];
    if (l.kind === 'ml') out[i] = h === a ? (l.side === 'draw' ? 1 : hasDraw(l.league) ? 0 : 2) : (l.side === 'draw' ? 0 : ((h > a ? 'home' : 'away') === l.side ? 1 : 0));
    else if (sp.t === 'total') { const t = h + a; out[i] = t === sp.line ? 2 : (sp.dir === 'over') === (t > sp.line) ? 1 : 0; }
    else if (sp.t === 'spread') { const d = (sp.side === 'home' ? h : a) + sp.line - (sp.side === 'home' ? a : h); out[i] = d === 0 ? 2 : d > 0 ? 1 : 0; }
    else if (sp.t === 'tt') { const v = sp.side === 'home' ? h : a; out[i] = v === sp.line ? 2 : (sp.dir === 'over') === (v > sp.line) ? 1 : 0; }
    else if (sp.t === 'ot') out[i] = (OT[i] === 1) === sp.yes ? 1 : 0;
    else if (sp.t === 'btts') out[i] = (h > 0 && a > 0) === sp.yes ? 1 : 0;
  }
  return out;
}
const TEAM_SPECIAL = new Set(['total', 'spread', 'tt', 'ot', 'btts']);
const isTeamLeg = (l) => l.kind === 'ml' || (l.kind === 'special' && l.sp && TEAM_SPECIAL.has(l.sp.t));

/** Simulate a player's stat to the end. */
function propOutcomes(l, data, st, group, rng, n) {
  const out = new Uint8Array(n);
  const def = propDefsFor(l.league).find((d) => d.key === l.prop.stat);
  const gauss = gaussOf(rng), pois = poissonOf(rng, gauss);
  const dist = def ? def.dist : 'poisson', cv = def && def.sd ? def.sd : 0.35;
  const line = l.prop.line, over = l.prop.dir === 'over';
  const p0 = p0Of(l);
  const mu0 = meanFor(dist, cv, line, over ? p0 : 1 - p0); // what we expected of him over the whole game
  const nowRaw = st.state === 'pre' ? 0 : playerNow(data && data.box, { box: l.prop.box, playerId: l.prop.playerId, name: l.prop.name });
  const now = nowRaw == null ? 0 : nowRaw;
  // a player with nothing in the box score deep into the game most likely is not playing (the bet is then refunded)
  const dnp = nowRaw == null && st.state === 'in' && st.prog > 0.4 ? 0.65 : 0;
  // learn from the game so far: 0 points at half means fewer minutes than we thought, 25 means more
  const k = mu0 * 2 + 3;
  const f = clamp((k + now) / (k + mu0 * st.prog), 0.4, 1.8);
  let gf = 1;
  if (group === 'nba') { // starters sit in a blowout
    const m = Math.abs(st.hs - st.as);
    if (m >= 25 && st.prog > 0.55) gf = 0.5; else if (m >= 18 && st.prog > 0.65) gf = 0.7;
  }
  const rem = mu0 * st.tau * f * gf;
  for (let i = 0; i < n; i++) {
    if (dnp && rng() < dnp) { out[i] = 2; continue; }
    let add;
    if (dist === 'normal') add = Math.max(0, Math.round(rem + Math.max(1, mu0 * cv) * Math.sqrt(st.tau) * gauss()));
    else add = pois(rem);
    const fin = now + add;
    out[i] = fin === line ? 2 : (fin > line) === over ? 1 : 0;
  }
  return out;
}

/* ---------- the quote ---------- */
/**
 * What is this open bet worth right now?
 * states: Map of gameKey -> { game, box, plays } for every game that has started. Games that have not started need nothing.
 * Returns { ok:false, reason } or { ok:true, offer, fair, pWin, hold, rough, cut }.
 */
export function quoteBet(bet, states, now = Date.now(), streak = 0) {
  if (!bet || bet.status !== 'pending') return { ok: false, reason: 'This bet is already settled.' };
  let base = 1, wonLegs = 0, anyLive = false, rough = false;
  const sims = [];            // legs still to be decided
  const byGame = new Map();
  for (const l of bet.legs) {
    if (l.result === 'lost') return { ok: false, reason: 'This bet already lost.' };
    if (l.result === 'won') { base *= l.dec; wonLegs++; anyLive = true; continue; }
    if (l.result === 'push' || l.result === 'void') { anyLive = true; continue; }
    const started = new Date(l.date).getTime() <= now;
    const data = states.get(l.gameKey);
    if (started && !data) return { ok: false, reason: 'Waiting for the live score.', wait: true };
    const g = data && data.game;
    if (g && g.void) { anyLive = true; continue; }
    if (g && g.state === 'post') { // finished, not paid out yet
      const r = evalLeg(l, data);
      anyLive = true;
      if (r === 'lost') return { ok: false, reason: 'This bet already lost.' };
      if (r === 'won') { base *= l.dec; wonLegs++; }
      else if (r === 'pending') return { ok: false, reason: 'Settling now.', wait: true };
      continue;
    }
    if (g && g.state === 'in') anyLive = true;
    sims.push({ l, data, g });
    if (!byGame.has(l.gameKey)) byGame.set(l.gameKey, []);
    byGame.get(l.gameKey).push(l);
  }
  if (!anyLive) return { ok: false, reason: 'Cash out opens once one of the games starts.', early: true };
  const boost = 1 + streakBoost(streak);
  if (!sims.length) { // nothing left to play
    const pay = wonLegs ? Math.round(bet.stake * base * boost) : bet.stake;
    return { ok: true, offer: pay, fair: pay, pWin: 1, hold: pay, rough: false, cut: 0, final: true };
  }
  const seed = [bet.id, ...sims.map((s) => `${s.l.key}:${s.g ? `${s.g.home.score}-${s.g.away.score}-${s.g.period}-${s.g.clock}-${s.g.state}` : 'pre'}`)].join('|');
  const rng = rngOf(seed);
  const n = N;
  const outs = [];
  const gameSims = new Map();
  for (const { l, data, g } of sims) {
    const group = groupOf(l.league);
    if (!SPORT[group]) { outs.push({ o: Uint8Array.from({ length: n }, () => (rng() < p0Of(l) ? 1 : 0)), dec: l.dec }); rough = true; continue; }
    const st = g ? gameState(g) : { hs: 0, as: 0, tau: 1, prog: 0, ot: false, state: 'pre' };
    if (isTeamLeg(l)) {
      if (!gameSims.has(l.gameKey)) gameSims.set(l.gameKey, simGame(group, st, priorsFor(group, byGame.get(l.gameKey).filter(isTeamLeg)), rng, n));
      outs.push({ o: teamOutcomes(l, gameSims.get(l.gameKey), group, n), dec: l.dec });
    } else if (l.kind === 'prop' && l.prop) {
      outs.push({ o: propOutcomes(l, data, st, group, rng, n), dec: l.dec });
    } else if (l.kind === 'special' && l.sp && (l.sp.t === 'first' || l.sp.t === 'firstp')) {
      // decided the moment someone scores; until then it keeps its price
      const r = data && data.plays && data.plays.some((x) => x.scoring) ? evalSpecial(l, data) : 'pending';
      const o = new Uint8Array(n);
      if (r === 'won') o.fill(1); else if (r === 'lost') o.fill(0); else if (r === 'void') o.fill(2); else { const p = p0Of(l); for (let i = 0; i < n; i++) o[i] = rng() < p ? 1 : 0; rough = true; }
      outs.push({ o, dec: l.dec });
    } else { // other markets: no live model, keep the original chance
      const p = p0Of(l); const o = new Uint8Array(n); for (let i = 0; i < n; i++) o[i] = rng() < p ? 1 : 0;
      outs.push({ o, dec: l.dec }); rough = true;
    }
  }
  let sum = 0, wins = 0;
  for (let i = 0; i < n; i++) {
    let mult = base, won = wonLegs, dead = false;
    for (const { o, dec } of outs) { const v = o[i]; if (v === 0) { dead = true; break; } if (v === 1) { mult *= dec; won++; } }
    if (dead) continue;
    wins++;
    sum += won ? bet.stake * mult * boost : bet.stake;
  }
  const fair = sum / n, pWin = wins / n;
  const hold = Math.round(bet.stake * boost * outs.reduce((m, x) => m * x.dec, base));
  const cut = CUT + (rough ? 0.03 : 0);
  const offer = Math.floor(fair * (1 - cut));
  if (offer < 1) return { ok: false, reason: 'No offer. This one is almost out of reach.', pWin };
  return { ok: true, offer, fair: Math.round(fair), pWin, hold, rough, cut };
}

