import { CONSTELLATIONS } from '../../config/constellations';
import type { AppContext } from '../../app/AppContext';
import { h } from '../dom';

/** Sidebar brand header + constellation selector (future-proofed). */
export class Header {
  readonly el: HTMLElement;

  constructor(ctx: AppContext) {
    const active = ctx.store.constellation.id;
    const chips = CONSTELLATIONS.map((c) =>
      h(
        'button',
        {
          class: `chip ${c.id === active ? 'active' : ''}`,
          disabled: !c.available,
          title: c.available ? c.description : `${c.name} — coming soon`,
          style: `--chip-color: ${c.color}`,
        },
        h('span', { class: 'chip-dot' }),
        c.name,
        !c.available && h('small', { text: 'soon' }),
      ),
    );

    this.el = h(
      'div',
      { class: 'brand' },
      h(
        'div',
        { class: 'brand-row' },
        h('img', { src: `${import.meta.env.BASE_URL}favicon.svg`, alt: '', class: 'brand-logo' }),
        h('div', {}, h('h1', { text: 'SatView' }), h('p', { class: 'muted', text: 'Open-source satellite tracker' })),
      ),
      h('div', { class: 'chips', role: 'group', 'aria-label': 'Constellations' }, ...chips),
    );
  }
}
