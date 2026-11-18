import type { AppContext } from '../../app/AppContext';
import { byId, h, replaceChildren } from '../dom';
import { SearchBox } from './SearchBox';

/** Floating top bar over the globe: sidebar toggle, search, legend. */
export class Topbar {
  private readonly root = byId('topbar');

  constructor(ctx: AppContext) {
    const toggle = h(
      'button',
      {
        class: 'icon-btn sidebar-toggle',
        title: 'Toggle panel',
        'aria-label': 'Toggle side panel',
        onclick: () => document.body.classList.toggle('sidebar-collapsed'),
      },
      '☰',
    );

    const legend = h(
      'div',
      { class: 'legend small' },
      h('span', { class: 'legend-item' }, h('i', { class: 'dot sat' }), 'Satellite'),
      h('span', { class: 'legend-item' }, h('i', { class: 'dot up' }), 'Above you'),
      h('span', { class: 'legend-item' }, h('i', { class: 'dot sel' }), 'Selected'),
      h('span', { class: 'legend-item' }, h('i', { class: 'dot me' }), 'You'),
    );

    replaceChildren(this.root, toggle, new SearchBox(ctx).el, legend);
  }
}
