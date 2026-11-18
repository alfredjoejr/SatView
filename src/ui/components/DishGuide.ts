import type { AppContext } from '../../app/AppContext';
import { COVERAGE_SECTOR_COUNT, COVERAGE_STEP_SECONDS, COVERAGE_WINDOW_MINUTES } from '../../config/constants';
import { analyzeCoverage } from '../../core/orbit/coverageAnalyzer';
import type { SkyCoverage } from '../../core/types';
import { compassPoint, formatDeg } from '../../utils/format';
import { h, replaceChildren } from '../dom';
import { createPanel } from './Panel';
import { showToast } from './Toast';

/**
 * Dish positioning helper. Samples the next N minutes of passes and reports
 * the part of the sky where most satellites fly — that is where the dish
 * needs a clear, unobstructed view.
 */
export class DishGuide {
  readonly el: HTMLElement;
  private readonly content = h('div', { class: 'dish-content' });
  private readonly analyzeBtn: HTMLButtonElement;
  private readonly progress = h('progress', { max: 1, value: 0, hidden: true });
  private running = false;

  constructor(private readonly ctx: AppContext) {
    this.analyzeBtn = h('button', { class: 'btn primary block', onclick: () => void this.analyze() }, `Analyze next ${COVERAGE_WINDOW_MINUTES} min of sky`);
    const body = h('div', {}, this.content, this.progress, this.analyzeBtn);
    this.el = createPanel(body, { title: 'Dish placement guide', collapsible: true });

    const { bus } = ctx.store;
    bus.on('coverage:updated', () => this.render());
    bus.on('observer:changed', () => this.render());
    bus.on('catalog:loaded', () => this.render());
    this.render();
  }

  private async analyze(): Promise<void> {
    const { store } = this.ctx;
    if (this.running || !store.observer || store.records.length === 0) return;
    this.running = true;
    this.analyzeBtn.disabled = true;
    this.progress.hidden = false;
    this.progress.value = 0;
    try {
      const coverage = await analyzeCoverage(store.records, store.observer, store.elevationMaskDeg, this.ctx.getSimDate(), {
        group: store.constellation.celestrakGroup,
        windowMinutes: COVERAGE_WINDOW_MINUTES,
        stepSeconds: COVERAGE_STEP_SECONDS,
        sectorCount: COVERAGE_SECTOR_COUNT,
        onProgress: (f) => { this.progress.value = f; },
      });
      store.setCoverage(coverage);
    } catch (err) {
      showToast(`Analysis failed: ${(err as Error).message}`, 'error');
    } finally {
      this.running = false;
      this.analyzeBtn.disabled = false;
      this.progress.hidden = true;
    }
  }

  private render(): void {
    const { observer, coverage, records } = this.ctx.store;
    this.analyzeBtn.disabled = this.running || !observer || records.length === 0;

    if (!observer) {
      replaceChildren(this.content, h('p', { class: 'hint', text: 'Set your location first.' }));
      return;
    }
    if (!coverage) {
      replaceChildren(
        this.content,
        h('p', { class: 'hint' }, 'Find the part of the sky where satellites pass most often from your location. Your dish needs a clear view in that direction.'),
      );
      return;
    }
    replaceChildren(this.content, ...this.renderResult(coverage, observer.latDeg));
  }

  private renderResult(c: SkyCoverage, latDeg: number): HTMLElement[] {
    const dir = compassPoint(c.bestAzDeg);
    const half = c.bestSpanDeg / 2;
    const from = compassPoint(c.bestAzDeg - half);
    const to = compassPoint(c.bestAzDeg + half);
    const max = Math.max(1, ...c.sectorHits);
    const size = 360 / c.sectorCount;
    const hemisphereTip = latDeg >= 0
      ? 'In the northern hemisphere Starlink dishes usually tilt toward the north.'
      : 'In the southern hemisphere Starlink dishes usually tilt toward the south.';

    const bars = c.sectorHits.map((hits, i) =>
      h(
        'div',
        { class: `bar ${c.bestSectors.includes(i) ? 'best' : ''}`, title: `${compassPoint(i * size + size / 2)}: ${hits} sightings` },
        h('span', { class: 'bar-fill', style: `height:${Math.max(4, (hits / max) * 100)}%` }),
        h('span', { class: 'bar-label', text: compassPoint(i * size + size / 2) }),
      ),
    );

    return [
      h('div', { class: 'dish-headline' },
        h('span', { class: 'muted small', text: 'Keep this direction clear' }),
        h('strong', { class: 'dish-dir', text: `${dir} · ${Math.round(c.bestAzDeg)}°` }),
        h('span', { class: 'small', text: `${from} → ${to} sweep, avg. elevation ${formatDeg(c.bestAvgElDeg, 0)}` }),
      ),
      h('div', { class: 'bars' }, ...bars),
      h('ul', { class: 'tips' },
        h('li', { text: `~${c.avgVisibleCount.toFixed(1)} satellites above the mask on average over ${c.windowMinutes} min.` }),
        h('li', { text: 'Mount the dish high (roof/pole) with no trees, walls or poles inside the sweep above.' }),
        h('li', { text: hemisphereTip }),
      ),
      h('p', { class: 'disclaimer', text: 'Estimate from public orbital data. Use the official Starlink app\'s obstruction check for final placement.' }),
    ];
  }
}
