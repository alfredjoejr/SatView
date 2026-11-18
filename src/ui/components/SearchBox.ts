import type { AppContext } from '../../app/AppContext';
import type { SatelliteRecord } from '../../core/types';
import { h, replaceChildren } from '../dom';

const MAX_RESULTS = 12;

/** Search satellites by name or NORAD catalog number. */
export class SearchBox {
  readonly el: HTMLElement;
  private readonly input: HTMLInputElement;
  private readonly results = h('ul', { class: 'search-results', role: 'listbox', hidden: true });
  private matches: SatelliteRecord[] = [];
  private activeIndex = -1;

  constructor(private readonly ctx: AppContext) {
    this.input = h('input', {
      type: 'search',
      class: 'search-input',
      placeholder: 'Search satellites (name or NORAD ID)…',
      'aria-label': 'Search satellites',
      autocomplete: 'off',
      oninput: () => this.update(),
      onkeydown: (e: KeyboardEvent) => this.onKey(e),
      onfocus: () => this.update(),
    });
    this.el = h('div', { class: 'search' }, this.input, this.results);

    document.addEventListener('click', (e) => {
      if (!this.el.contains(e.target as Node)) this.hide();
    });
  }

  private update(): void {
    const q = this.input.value.trim().toLowerCase();
    if (!q) { this.hide(); return; }

    const records = this.ctx.store.records;
    this.matches = [];
    for (const r of records) {
      if (r.name.toLowerCase().includes(q) || String(r.noradId).startsWith(q)) {
        this.matches.push(r);
        if (this.matches.length >= MAX_RESULTS) break;
      }
    }
    this.activeIndex = this.matches.length ? 0 : -1;
    this.renderResults();
  }

  private renderResults(): void {
    if (this.matches.length === 0) {
      replaceChildren(this.results, h('li', { class: 'empty', text: 'No matches' }));
    } else {
      replaceChildren(
        this.results,
        ...this.matches.map((r, i) =>
          h(
            'li',
            {
              class: i === this.activeIndex ? 'active' : '',
              role: 'option',
              onmousedown: (e: MouseEvent) => { e.preventDefault(); this.choose(r); },
            },
            h('span', { text: r.name }),
            h('small', { class: 'muted mono', text: `#${r.noradId}` }),
          ),
        ),
      );
    }
    this.results.hidden = false;
  }

  private onKey(e: KeyboardEvent): void {
    if (this.results.hidden || this.matches.length === 0) return;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const delta = e.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + delta + this.matches.length) % this.matches.length;
      this.renderResults();
    } else if (e.key === 'Enter' && this.activeIndex >= 0) {
      e.preventDefault();
      this.choose(this.matches[this.activeIndex]);
    } else if (e.key === 'Escape') {
      this.hide();
    }
  }

  private choose(record: SatelliteRecord): void {
    this.ctx.store.select(record.index);
    this.ctx.flyToSatellite(record.index);
    this.input.value = record.name;
    this.hide();
    this.input.blur();
  }

  private hide(): void {
    this.results.hidden = true;
  }
}
