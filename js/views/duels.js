// Duels: head-to-head picks with coins on the line (game, day or week), plus the solo Daily Five.
import { h, clear, toast, poll } from '../ui.js';
import * as soc from '../social.js';
import { getBank } from '../store.js';
import { gate, claimBar, fmt, dayTime, loader, actionBtn, errText, sideBtn, bubble } from '../social-ui.js';

const LEN = { game: ['One game', '3 cards from a single game'], day: ['One day', '5 cards from the day\'s slate'], week: ['One week', '10 cards over 7 days'] };
const STAKES = [25, 50, 100, 250];

export async function render(root, params = {}) {
  if (!gate(root, 'Duels', 'Pick against a friend. Winner takes the pot.')) return;
  const host = h('div', { class: 'duels' });
  root.append(host);
  if (params.id) return detail(host, params.id);
  return list(host);
}

/* ---------------------------------------------------------------- the list */
function list(host) {
  let mode = 'list';
  let stopPoll = () => {};
  const top = h('div');
  host.append(top);
  const paint = () => {
    clear(top);
    if (mode === 'new') return top.append(form(() => { mode = 'list'; paint(); }));
    top.append(claimBar(() => load(false)), h('div', { class: 'duel-main' }));
    load(true);
  };
  const load = (spin) => {
    const el = top.querySelector('.duel-main');
    if (!el) return;
    return loader(el, async () => ({ d: await soc.duels(), f: await soc.daily().catch(() => null) }), ({ d, f }) => {
      el.append(
        h('div', { class: 'duel-head' },
          h('div', null, h('b', null, `${d.record.w}–${d.record.l}${d.record.t ? `–${d.record.t}` : ''}`), h('small', null, ' duel record')),
          h('button', { type: 'button', class: 'btn main', id: 'duel-new', onclick: () => { mode = 'new'; paint(); } }, 'New duel')),
        d.open.length ? h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Challenges for you', h('small', null, `${d.open.length}`)), h('div', { class: 'stack' }, d.open.map(row))) : null,
        h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Your duels'),
          d.mine.length ? h('div', { class: 'stack' }, d.mine.map(row)) : h('p', { class: 'muted' }, 'No duels yet. Start one and send your friend a heads up.')),
        f ? daily(f, () => load(false)) : null);
    })(spin === false ? true : false);
  };
  paint();
  stopPoll = poll(() => { if (mode === 'list') load(false); }, 30000);
  return () => stopPoll();
}

function row(d) {
  const other = d.you === 'creator' ? d.opponent : d.creator;
  const who = d.you === 'creator' ? (d.opponent ? `vs ${d.opponent.display}` : 'Open to anyone') : `${d.creator.display} challenges you`;
  const res = d.status === 'settled' ? (d.winner ? (d.you !== 'viewer' && ((d.you === 'creator' && d.winner === d.creator.handle) || (d.you === 'opponent' && d.winner === d.opponent.handle)) ? 'You won' : 'You lost') : 'Tied') : d.status;
  return h('a', { class: 'duel-row', href: `#/duels/${d.id}`, 'data-id': d.id },
    bubble(other || d.creator, 'bust sm'),
    h('div', { class: 'dr-main' }, h('b', null, who), h('small', null, `${LEN[d.length][0]} · ${fmt(d.stake)} each`)),
    h('span', { class: 'pill ' + (res === 'You won' ? 'won' : res === 'You lost' ? 'lost' : 'pending') }, res));
}

/* ------------------------------------------------------------ new duel form */
function form(done) {
  const st = { length: 'game', stake: 50, opponent: '', game: '', day: '' };
  const box = h('section', { class: 'card duel-form' });
  let crewList = [], slate = null;
  const paint = () => {
    clear(box);
    const games = slate ? slate.games.filter((g) => g.cards >= 3) : [];
    if (st.length === 'game' && !st.game && games[0]) st.game = games[0].key;
    if (st.length === 'day' && !st.day && slate) st.day = slate.today;
    const days = slate ? [slate.today, new Date(new Date(slate.today + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10)] : [];
    box.append(
      h('h2', { class: 'card-h' }, 'New duel', h('small', null, `${fmt(getBank().coins)} coins`)),
      h('div', { class: 'seg' }, Object.keys(LEN).map((k) => h('button', { type: 'button', class: 'seg-b' + (st.length === k ? ' on' : ''), 'data-len': k, onclick: () => { st.length = k; paint(); } }, LEN[k][0]))),
      h('p', { class: 'muted' }, LEN[st.length][1] + '. Picks lock when each card\'s game starts.'),
      st.length === 'game' ? h('label', { class: 'field' }, h('span', null, 'Game'),
        games.length ? h('select', { id: 'd-game', onchange: (e) => { st.game = e.target.value; } }, games.map((g) => h('option', { value: g.key, selected: g.key === st.game ? '' : null }, `${g.away.abbr || g.away.name} at ${g.home.abbr || g.home.name} · ${dayTime(g.start_at)}`)))
          : h('small', { class: 'muted' }, slate ? 'No games with enough cards right now. New cards arrive twice a day.' : 'Loading…')) : null,
      st.length === 'day' ? h('label', { class: 'field' }, h('span', null, 'Day'), h('select', { id: 'd-day', onchange: (e) => { st.day = e.target.value; } }, days.map((d, i) => h('option', { value: d, selected: d === st.day ? '' : null }, i === 0 ? 'Today' : 'Tomorrow')))) : null,
      h('label', { class: 'field' }, h('span', null, 'Opponent'), h('select', { id: 'd-opp', onchange: (e) => { st.opponent = e.target.value; } },
        h('option', { value: '' }, 'Anyone in the crew'), crewList.map((m) => h('option', { value: m.handle, selected: m.handle === st.opponent ? '' : null }, m.display)))),
      h('div', { class: 'field' }, h('span', null, 'Stake (each)'),
        h('div', { class: 'chip-row' }, STAKES.map((n) => h('button', { type: 'button', class: 'chip' + (st.stake === n ? ' on' : ''), 'aria-pressed': st.stake === n ? 'true' : 'false', onclick: () => { st.stake = n; paint(); } }, fmt(n)))),
        h('input', { class: 'inp', id: 'd-stake', type: 'number', min: '10', max: '500', value: st.stake, onchange: (e) => { st.stake = Math.floor(Number(e.target.value)) || 0; } })),
      h('p', { class: 'muted' }, `Pot ${fmt(st.stake * 2)}. The winner takes it minus a 5% cut. A tie, or a duel with fewer than 3 finished cards, gives stakes back.`),
      h('div', { class: 'row wrap' },
        actionBtn('Send challenge', async () => {
          if (st.stake < 10 || st.stake > 500) throw new Error('Stakes are 10 to 500 coins.');
          const r = await soc.duelCreate({ length: st.length, stake: st.stake, opponent: st.opponent, game: st.length === 'game' ? st.game : null, day: st.length === 'day' ? st.day : null });
          location.hash = `#/duels/${r.duel.id}`;
        }, 'btn main big'),
        h('button', { type: 'button', class: 'btn', onclick: done }, 'Back')));
  };
  paint();
  Promise.all([soc.crew().then((c) => { crewList = c.members.filter((m) => !m.me); }).catch(() => {}), soc.slate().then((s) => { slate = s; }).catch(() => { slate = { today: '', games: [] }; })]).then(paint);
  return box;
}

/* ------------------------------------------------------------- one duel */
function detail(host, id) {
  const wrap = h('div', { class: 'duel-detail' });
  host.append(h('a', { class: 'back-link', href: '#/duels' }, '‹ All duels'), wrap);
  let cur = null;
  const run = loader(wrap, async () => (await soc.duel(id)).duel, (d) => { cur = d; draw(d); });
  const draw = (d) => {
    clear(wrap);
    const mine = d.you;
    const oppName = mine === 'creator' ? (d.opponent ? d.opponent.display : 'Anyone') : d.creator.display;
    const won = d.winner && ((mine === 'creator' && d.winner === d.creator.handle) || (mine === 'opponent' && d.opponent && d.winner === d.opponent.handle));
    const banner = d.status === 'open' ? (mine === 'creator' ? 'Waiting for someone to accept.' : 'Accept to lock in your stake.')
      : d.status === 'active' ? 'In play.' : d.status === 'settled' ? (d.winner ? (won ? `You won ${fmt(d.result.pot - d.result.cut)} coins.` : `${d.winner} won.`) : 'Tied. Stakes returned.')
        : d.status === 'void' ? 'Not enough finished cards. Stakes returned.' : `Duel ${d.status}.`;
    wrap.append(
      h('section', { class: 'card duel-top' },
        h('div', { class: 'vs' }, h('div', { class: 'vs-p' }, bubble(d.creator), h('b', null, d.creator.display)), h('span', { class: 'vs-x' }, 'vs'),
          h('div', { class: 'vs-p' }, d.opponent ? [bubble(d.opponent), h('b', null, d.opponent.display)] : [h('span', { class: 'who-init' }, '?'), h('b', null, 'Open')])),
        h('p', null, h('b', null, `${LEN[d.length][0]} · ${fmt(d.stake)} each · pot ${fmt(d.pot)}`)),
        h('p', { class: 'duel-banner', role: 'status' }, banner),
        d.result && d.result.creator != null ? h('p', { class: 'muted' }, `${d.creator.display} ${d.result.creator} – ${d.result.opponent} ${d.opponent ? d.opponent.display : ''}`) : null,
        d.status === 'open' ? h('p', { class: 'muted' }, `Expires ${dayTime(d.expires_at)}`) : null,
        d.status === 'open' && mine !== 'creator'
          ? h('div', { class: 'row wrap' }, actionBtn(`Accept (${fmt(d.stake)} coins)`, async () => { const r = await soc.duelAccept(d.id, d.stake); cur = r.duel; toast('Duel is on'); draw(r.duel); }, 'btn main'),
            actionBtn('Decline', async () => { await soc.duelCancel(d.id); toast('Declined'); location.hash = '#/duels'; }, 'btn'))
          : null,
        d.status === 'open' && mine === 'creator' ? actionBtn('Cancel challenge', async () => { await soc.duelCancel(d.id); toast('Cancelled. Collect your stake from Duels.'); location.hash = '#/duels'; }, 'btn danger') : null),
      d.cards.length ? h('section', { class: 'card' }, h('h2', { class: 'card-h' }, 'Cards', h('small', null, d.length === 'week' && d.status === 'active' ? `${d.cards.length} of ${d.target} so far, more each day` : `${d.cards.length}`)),
        h('div', { class: 'stack' }, d.cards.map((c) => cardRow(c, d, oppName, (nd) => { cur = nd; draw(nd); }))))
        : (d.length === 'week' && d.status === 'open' ? h('p', { class: 'muted' }, 'Cards are dealt once the duel is accepted: 3 right away, then up to 3 new ones each day.') : null));
  };
  run();
  const stop = poll(() => { if (cur && ['open', 'active'].includes(cur.status)) run(true); }, 20000);
  return () => stop();
}

function cardRow(c, d, oppName, onNew) {
  const canPick = !c.locked && (d.status === 'active' || (d.status === 'open' && d.you === 'creator'));
  const pick = async (side) => { try { const r = await soc.duelPick(d.id, c.id, side); onNew(r.duel); } catch (e) { toast(errText(e)); } };
  const mineSide = c.mine, theirs = c.theirs;
  const ok = c.outcome === 'a' || c.outcome === 'b' ? (mineSide ? (mineSide === c.outcome ? 'good' : 'bad') : '') : '';
  const lab = (s) => (c.line != null && c.kind !== 'winner' ? `${s === 'a' ? c.a : c.b} ${c.line}` : s === 'a' ? c.a : c.b);
  return h('article', { class: `dcard ${ok}${c.status === 'void' ? ' void' : ''}`, 'data-card': c.id },
    h('div', { class: 'dc-t' }, h('b', null, c.title), h('small', null, c.status === 'final' ? (c.outcome === 'push' ? 'Push' : `Result: ${lab(c.outcome)}${c.actual != null ? ` (${c.actual})` : ''}`) : c.status === 'void' ? 'Void' : c.locked ? 'Locked' : `Locks ${dayTime(c.start_at)}`)),
    h('div', { class: 'dc-s' }, sideBtn(lab('a'), mineSide === 'a', !canPick, () => pick('a')), sideBtn(lab('b'), mineSide === 'b', !canPick, () => pick('b'))),
    d.opponent && d.status !== 'open' ? h('small', { class: 'dc-o' }, theirs ? `${oppName} took ${lab(theirs)}` : c.their_made ? `${oppName} has picked` : `${oppName} has not picked`) : null);
}

/* -------------------------------------------------------------- daily five */
function daily(f, reload) {
  const sec = h('section', { class: 'card daily' });
  const right = f.cards.filter((c) => c.result === 'win').length;
  sec.append(h('h2', { class: 'card-h' }, 'Daily Five', h('small', null, `practice · ${f.coins_per_win} coins a win · streak ${f.streak}${f.best ? ` (best ${f.best})` : ''}`)),
    f.cards.length ? h('div', { class: 'stack' }, f.cards.map((c) => {
      const lab = (s) => (c.line != null && c.kind !== 'winner' ? `${s === 'a' ? c.a : c.b} ${c.line}` : s === 'a' ? c.a : c.b);
      const pick = async (side) => { try { await soc.dailyPick(c.id, side); reload(); } catch (e) { toast(errText(e)); } };
      return h('article', { class: `dcard ${c.result === 'win' ? 'good' : c.result === 'loss' ? 'bad' : ''}`, 'data-card': c.id },
        h('div', { class: 'dc-t' }, h('b', null, c.title), h('small', null, c.result ? (c.result === 'win' ? 'Right' : c.result === 'loss' ? 'Wrong' : 'No result') : c.locked ? 'Locked' : `Locks ${dayTime(c.start_at)}`)),
        h('div', { class: 'dc-s' }, sideBtn(lab('a'), c.mine === 'a', c.locked, () => pick('a')), sideBtn(lab('b'), c.mine === 'b', c.locked, () => pick('b'))));
    })) : h('p', { class: 'muted' }, 'Today\'s five arrive with the next slate.'),
    right ? h('p', { class: 'muted' }, `${right} right so far today.`) : null);
  return sec;
}
