import type { AppContext } from '../../app/AppContext';
import { MAX_ELEVATION_MASK_DEG, MIN_ELEVATION_MASK_DEG } from '../../config/constants';
import { formatLatLon } from '../../utils/format';
import { h, replaceChildren } from '../dom';
import { createPanel } from './Panel';
import { showToast } from './Toast';

/** "Where am I?" — geolocation, manual coordinates, globe picking and elevation mask. */
export class LocationPanel {
  readonly el: HTMLElement;
  private readonly summary = h('div', { class: 'loc-summary' });
  private readonly locateBtn: HTMLButtonElement;
  private readonly pickBtn: HTMLButtonElement;
  private readonly flyBtn: HTMLButtonElement;
  private readonly latInput = h('input', { type: 'number', step: 'any', min: -90, max: 90, placeholder: 'Latitude', 'aria-label': 'Latitude' });
  private readonly lonInput = h('input', { type: 'number', step: 'any', min: -180, max: 180, placeholder: 'Longitude', 'aria-label': 'Longitude' });
  private readonly maskInput: HTMLInputElement;
  private readonly maskValue = h('strong');

  constructor(private readonly ctx: AppContext) {
    const { store } = ctx;

    this.locateBtn = h('button', { class: 'btn primary', onclick: () => void this.locate() }, '◎ Use my location');
    this.pickBtn = h('button', { class: 'btn', onclick: () => store.setPickMode(!store.pickLocationMode) }, '✛ Pick on globe');
    this.flyBtn = h('button', { class: 'btn', onclick: () => ctx.flyToObserver() }, '⌖ Fly to');

    const form = h(
      'form',
      { class: 'loc-form', onsubmit: (e: SubmitEvent) => { e.preventDefault(); this.applyManual(); } },
      this.latInput,
      this.lonInput,
      h('button', { type: 'submit', class: 'btn' }, 'Set'),
    );

    this.maskInput = h('input', {
      type: 'range',
      min: MIN_ELEVATION_MASK_DEG,
      max: MAX_ELEVATION_MASK_DEG,
      step: 1,
      value: store.elevationMaskDeg,
      'aria-label': 'Minimum elevation',
      oninput: () => store.setElevationMask(Number(this.maskInput.value)),
    });

    const body = h(
      'div',
      {},
      this.summary,
      h('div', { class: 'btn-row' }, this.locateBtn, this.pickBtn, this.flyBtn),
      form,
      h(
        'label',
        { class: 'mask-control' },
        h('span', {}, 'Min. elevation ', this.maskValue),
        this.maskInput,
        h('small', { class: 'muted', text: 'Starlink dishes use satellites above ~25°.' }),
      ),
    );
    this.el = createPanel(body, { title: 'Your location', collapsible: true });

    store.bus.on('observer:changed', () => this.render());
    store.bus.on('mask:changed', () => this.render());
    store.bus.on('pickmode:changed', ({ active }) => {
      this.pickBtn.classList.toggle('active', active);
      this.pickBtn.textContent = active ? 'Click the globe…' : '✛ Pick on globe';
    });
    this.render();
  }

  private render(): void {
    const { observer, elevationMaskDeg } = this.ctx.store;
    this.maskValue.textContent = `${elevationMaskDeg}°`;
    this.maskInput.value = String(elevationMaskDeg);
    this.flyBtn.disabled = !observer;

    if (!observer) {
      replaceChildren(
        this.summary,
        h('p', { class: 'hint' }, 'Set your location to see which satellites are above you and get dish-placement guidance.'),
      );
      return;
    }
    replaceChildren(
      this.summary,
      h('div', { class: 'loc-label' }, observer.label, h('span', { class: `badge ${observer.source}`, text: observer.source === 'gps' ? 'GPS' : 'Manual' })),
      h('div', { class: 'loc-coords mono', text: formatLatLon(observer.latDeg, observer.lonDeg) }),
      observer.accuracyM !== undefined && h('small', { class: 'muted', text: `±${Math.round(observer.accuracyM)} m accuracy` }),
    );
    this.latInput.value = observer.latDeg.toFixed(4);
    this.lonInput.value = observer.lonDeg.toFixed(4);
  }

  private async locate(): Promise<void> {
    const btn = this.locateBtn;
    btn.disabled = true;
    btn.textContent = 'Locating…';
    try {
      const observer = await this.ctx.observerService.locate();
      this.ctx.store.setObserver(observer);
      this.ctx.flyToObserver();
      showToast('Location found.', 'success', 2500);
    } catch (err) {
      showToast((err as Error).message, 'error', 7000);
    } finally {
      btn.disabled = false;
      btn.textContent = '◎ Use my location';
    }
  }

  private applyManual(): void {
    try {
      const observer = this.ctx.observerService.createManual(Number(this.latInput.value), Number(this.lonInput.value));
      this.ctx.store.setObserver(observer);
      this.ctx.flyToObserver();
    } catch (err) {
      showToast((err as Error).message, 'warning');
    }
  }
}
