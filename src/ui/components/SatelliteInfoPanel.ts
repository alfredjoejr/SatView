import type { AppContext } from '../../app/AppContext';
import { PASS_SEARCH_HOURS } from '../../config/constants';
import { createObserverFrame, lookAngleFromEcf } from '../../core/orbit/lookAngles';
import { predictNextPass } from '../../core/orbit/passPredictor';
import { propagateState, vectorLength } from '../../core/orbit/propagator';
import type { SatellitePass } from '../../core/types';
import {
  formatAzimuth,
  formatClock,
  formatDeg,
  formatDuration,
  formatKm,
  timeAgo,
} from '../../utils/format';
import { byId, h, replaceChildren } from '../dom';

type RowKey =
  | 'norad' | 'intl' | 'epoch' | 'incl' | 'period'
  | 'lat' | 'lon' | 'alt' | 'speed'
  | 'az' | 'el' | 'range';

const ROWS: [RowKey, string][] = [
  ['lat', 'Latitude'], ['lon', 'Longitude'], ['alt', 'Altitude'], ['speed', 'Speed'],
  ['az', 'Azimuth'], ['el', 'Elevation'], ['range', 'Distance'],
  ['norad', 'NORAD ID'], ['intl', 'Intl. designator'], ['incl', 'Inclination'], ['period', 'Period'], ['epoch', 'Data epoch'],
];

/** Floating details card for the selected satellite (live position + next pass). */
export class SatelliteInfoPanel {
  private readonly root = byId('info-panel');
  private readonly title = h('h3');
  private readonly status = h('span', { class: 'badge' });
  private readonly values = new Map<RowKey, HTMLElement>();
  private readonly passBox = h('div', { class: 'pass-box' });
  private pass: SatellitePass | null = null;
  private passComputedAt = 0;

  constructor(private readonly ctx: AppContext) {
    const table = h('dl', { class: 'info-grid' });
    for (const [key, label] of ROWS) {
      const value = h('dd', { class: 'mono' });
      this.values.set(key, value);
      table.append(h('dt', { text: label }), value);
    }

    replaceChildren(
      this.root,
      h('header', { class: 'info-header' },
        h('div', {}, this.title, this.status),
        h('button', { class: 'icon-btn', title: 'Close', 'aria-label': 'Close', onclick: () => ctx.store.select(null) }, '✕'),
      ),
      this.passBox,
      table,
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', onclick: () => this.flyTo() }, '⌖ Fly to satellite'),
      ),
    );

    const { bus } = ctx.store;
    bus.on('selection:changed', () => this.onSelectionChanged());
    bus.on('observer:changed', () => this.invalidatePass());
    bus.on('mask:changed', () => this.invalidatePass());
    bus.on('tick', ({ date }) => this.updateLive(date));
  }

  private flyTo(): void {
    const index = this.ctx.store.selectedIndex;
    if (index !== null) this.ctx.flyToSatellite(index);
  }

  private onSelectionChanged(): void {
    const record = this.ctx.store.selectedRecord;
    this.root.hidden = !record;
    if (!record) return;

    this.title.textContent = record.name;
    this.set('norad', String(record.noradId));
    this.set('intl', record.intlDesignator || '—');
    this.set('incl', formatDeg(record.inclinationDeg, 2));
    this.set('period', `${record.periodMin.toFixed(1)} min`);
    this.set('epoch', timeAgo(record.epoch));
    this.invalidatePass();
    this.updateLive(this.ctx.getSimDate());
  }

  private invalidatePass(): void {
    this.pass = null;
    this.passComputedAt = 0;
    if (this.ctx.store.selectedRecord) this.updateLive(this.ctx.getSimDate());
  }

  private updateLive(date: Date): void {
    const { store } = this.ctx;
    const record = store.selectedRecord;
    if (!record) return;

    const state = propagateState(record.satrec, date);
    if (!state) {
      this.status.textContent = 'No data';
      return;
    }
    const geo = this.ctx.sim.getGeodetic(record.index);
    if (geo) {
      this.set('lat', formatDeg(geo.latDeg, 3));
      this.set('lon', formatDeg(geo.lonDeg, 3));
      this.set('alt', formatKm(geo.altKm, 1));
    }
    this.set('speed', `${vectorLength(state.velocityEci).toFixed(2)} km/s`);

    const observer = store.observer;
    if (!observer) {
      for (const k of ['az', 'el', 'range'] as const) this.set(k, '—');
      this.status.textContent = '';
      this.status.className = 'badge';
      replaceChildren(this.passBox, h('p', { class: 'muted small', text: 'Set your location for pass predictions.' }));
      return;
    }

    const frame = createObserverFrame(observer);
    const look = lookAngleFromEcf(frame, state.ecf);
    const isUp = look.elDeg >= store.elevationMaskDeg;
    this.set('az', formatAzimuth(look.azDeg));
    this.set('el', formatDeg(look.elDeg, 1));
    this.set('range', formatKm(look.rangeKm));
    this.status.textContent = isUp ? 'Overhead' : look.elDeg > 0 ? 'Low' : 'Below horizon';
    this.status.className = `badge ${isUp ? 'up' : 'down'}`;

    const stale = this.passComputedAt === 0
      || (this.pass !== null && date.getTime() > this.pass.los.getTime())
      || Math.abs(date.getTime() - this.passComputedAt) > 10 * 60_000;
    if (stale) {
      this.pass = predictNextPass(record.satrec, frame, store.elevationMaskDeg, date, PASS_SEARCH_HOURS);
      this.passComputedAt = date.getTime();
    }
    this.renderPass(date);
  }

  private renderPass(now: Date): void {
    const p = this.pass;
    if (!p) {
      replaceChildren(this.passBox, h('p', { class: 'muted small', text: `No pass above ${this.ctx.store.elevationMaskDeg}° in the next ${PASS_SEARCH_HOURS} h.` }));
      return;
    }
    const inProgress = now >= p.aos && now <= p.los;
    const headline = inProgress
      ? `Overhead now — sets in ${formatDuration(p.los.getTime() - now.getTime())}`
      : `Next pass in ${formatDuration(p.aos.getTime() - now.getTime())}`;

    replaceChildren(
      this.passBox,
      h('strong', { class: inProgress ? 'up-text' : '', text: headline }),
      h('div', { class: 'pass-grid small' },
        h('span', { text: `Rise ${formatClock(p.aos)} · ${formatAzimuth(p.aosAzDeg)}` }),
        h('span', { text: `Peak ${formatClock(p.maxElTime)} · ${formatDeg(p.maxElDeg, 0)}` }),
        h('span', { text: `Set ${formatClock(p.los)} · ${formatAzimuth(p.losAzDeg)}` }),
      ),
    );
  }

  private set(key: RowKey, text: string): void {
    const el = this.values.get(key);
    if (el && el.textContent !== text) el.textContent = text;
  }
}
