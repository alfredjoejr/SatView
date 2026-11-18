import { h } from '../dom';

export interface PanelOptions {
  title: string;
  /** Optional element placed on the right side of the header (badge, button…). */
  headerExtra?: HTMLElement;
  collapsible?: boolean;
  collapsed?: boolean;
  className?: string;
}

/** Card-style sidebar section with an optional collapse toggle. */
export function createPanel(body: HTMLElement, options: PanelOptions): HTMLElement {
  const panel = h('section', { class: `panel ${options.className ?? ''}` });
  const header = h('header', { class: 'panel-header' }, h('h2', { text: options.title }), options.headerExtra);

  if (options.collapsible) {
    header.classList.add('collapsible');
    header.setAttribute('role', 'button');
    header.tabIndex = 0;
    const toggle = () => panel.classList.toggle('collapsed');
    header.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('button, input')) return;
      toggle();
    });
    header.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
    if (options.collapsed) panel.classList.add('collapsed');
  }

  body.classList.add('panel-body');
  panel.append(header, body);
  return panel;
}
