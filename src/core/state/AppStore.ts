import { DEFAULT_CONSTELLATION_ID, getConstellation, type ConstellationConfig } from '../../config/constellations';
import { DEFAULT_ELEVATION_MASK_DEG } from '../../config/constants';
import { EventBus } from '../events/EventBus';
import type { AppEvents } from '../events/appEvents';
import type {
  CatalogMeta,
  ObserverLocation,
  SatelliteRecord,
  SkyCoverage,
  VisibleSatellite,
} from '../types';

/**
 * Single source of truth for application state. Mutations go through setters
 * which emit events so the globe and UI can react.
 */
export class AppStore {
  readonly bus = new EventBus<AppEvents>();

  private _constellation: ConstellationConfig = getConstellation(DEFAULT_CONSTELLATION_ID);
  private _records: SatelliteRecord[] = [];
  private _catalogMeta: CatalogMeta | null = null;
  private _selectedIndex: number | null = null;
  private _observer: ObserverLocation | null = null;
  private _elevationMaskDeg = DEFAULT_ELEVATION_MASK_DEG;
  private _visible: VisibleSatellite[] = [];
  private _coverage: SkyCoverage | null = null;
  private _pickLocationMode = false;

  get constellation(): ConstellationConfig { return this._constellation; }
  get records(): readonly SatelliteRecord[] { return this._records; }
  get catalogMeta(): CatalogMeta | null { return this._catalogMeta; }
  get selectedIndex(): number | null { return this._selectedIndex; }
  get selectedRecord(): SatelliteRecord | null {
    return this._selectedIndex === null ? null : this._records[this._selectedIndex] ?? null;
  }
  get observer(): ObserverLocation | null { return this._observer; }
  get elevationMaskDeg(): number { return this._elevationMaskDeg; }
  get visible(): readonly VisibleSatellite[] { return this._visible; }
  get coverage(): SkyCoverage | null { return this._coverage; }
  get pickLocationMode(): boolean { return this._pickLocationMode; }

  setCatalog(records: SatelliteRecord[], meta: CatalogMeta): void {
    this._records = records;
    this._catalogMeta = meta;
    this.select(null);
    this.setVisible([]);
    this.setCoverage(null);
    this.bus.emit('catalog:loaded', meta);
  }

  select(index: number | null): void {
    if (index !== null && !this._records[index]) index = null;
    if (index === this._selectedIndex) return;
    this._selectedIndex = index;
    this.bus.emit('selection:changed', { index });
  }

  setObserver(observer: ObserverLocation | null): void {
    this._observer = observer;
    this.setCoverage(null);
    this.bus.emit('observer:changed', { observer });
  }

  setElevationMask(maskDeg: number): void {
    if (maskDeg === this._elevationMaskDeg) return;
    this._elevationMaskDeg = maskDeg;
    this.setCoverage(null);
    this.bus.emit('mask:changed', { maskDeg });
  }

  setVisible(visible: VisibleSatellite[]): void {
    this._visible = visible;
    this.bus.emit('visibility:updated', { visible });
  }

  setCoverage(coverage: SkyCoverage | null): void {
    if (coverage === null && this._coverage === null) return;
    this._coverage = coverage;
    this.bus.emit('coverage:updated', { coverage });
  }

  setPickMode(active: boolean): void {
    if (active === this._pickLocationMode) return;
    this._pickLocationMode = active;
    this.bus.emit('pickmode:changed', { active });
  }
}
