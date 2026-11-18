import type { AppContext } from '../../app/AppContext';
import { VISIBLE_LIST_LIMIT } from '../../config/constants';
import { compassPoint, formatCount } from '../../utils/format';
import { h, replaceChildren } from '../dom';
import { createPanel } from './Panel';

/** Table of satellites currently above the observer's elevation mask. */
export class VisibleList {
  readonly el: HTMLElement;
  private readonly list = h('ol', { class: 'sat-list' });
  private readonly countBadge = h('span', { class: 'badge count', text: '0' });

  constructor(private readonly ctx: AppContext) {
    const header = h('div', { class: 'sat-list-head muted small' },
      h('span', { text: 'Satellite' }), h('span', { text: 'Elev' }), h('span', { text: 'Azim' }), h('span', { text: 'Range' }));
    const body = h('div', {}, header, this.list);
    this.el = createPanel(body, { title: 'Overhead now', headerExtra: this.countBadge, collapsible: true });

    const { bus } = ctx.store;
    bus.on('visibility:updated', () => this.render());
    bus.on('selection:changed', () => this.render());
    bus.on('observer:changed', () => this.render());
    this.render();
  }

  private render(): void {
    const { store } = this.ctx;
    this.countBadge.textContent = formatCount(store.visible.length);

    if (!store.observer) {
      replaceChildren(this.list, h('li', { class: 'empty', text: 'Set your location to list satellites above you.' }));
      return;
    }
    if (store.visible.length === 0) {
      replaceChildren(this.list, h('li', { class: 'empty', text: 'No satellites above the elevation mask right now.' }));
      return;
    }

    const rows = store.visible.slice(0, VISIBLE_LIST_LIMIT).map((v) => {
      const rec = store.records[v.index];
      return h(
        'li',
        {
          class: `sat-row ${v.index === store.selectedIndex ? 'selected' : ''}`,
          tabindex: 0,
          onclick: () => store.select(v.index),
          onkeydown: (e: KeyboardEvent) => { if (e.key === 'Enter') store.select(v.index); },
        },
        h('span', { class: 'sat-name', text: rec?.name ?? `#${v.index}` }),
        h('span', { class: 'mono', text: `${v.look.elDeg.toFixed(0)}°` }),
        h('span', { class: 'mono', text: `${compassPoint(v.look.azDeg)}` }),
        h('span', { class: 'mono', text: `${Math.round(v.look.rangeKm)} km` }),
      );
    });
    if (store.visible.length > VISIBLE_LIST_LIMIT) {
      rows.push(h('li', { class: 'empty', text: `+${store.visible.length - VISIBLE_LIST_LIMIT} more…` }));
    }
    replaceChildren(this.list, ...rows);
  }
}
