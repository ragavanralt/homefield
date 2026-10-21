// Daily Five: five practice picks a day, with live progress and a recap of how they ended.
import { h, poll } from '../ui.js';
import * as soc from '../social.js';
import { gate, claimBar, loader } from '../social-ui.js';
import { daily } from './duels.js';

export async function render(root) {
  if (!gate(root, 'Daily Five', 'Five picks a day. See how close each one was.')) return;
  const host = h('div', { class: 'duels' });
  root.append(host);
  const el = h('div');
  host.append(claimBar(() => load(false)), el);
  const load = (spin) => loader(el, () => soc.daily(), (f) => { el.append(daily(f, () => load(false))); })(spin === false);
  load(true);
  const stop = poll(() => load(false), 90000);
  return () => stop();
}
