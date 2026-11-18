import { JulianDate, type Viewer } from 'cesium';
import {
  SIM_JUMP_THRESHOLD_MS,
  SIM_STEP_INTERVAL_MS,
  VISIBILITY_INTERVAL_MS,
} from '../config/constants';
import { loadConstellation } from '../core/data/catalogService';
import { ObserverService } from '../core/observer/ObserverService';
import { computeVisible } from '../core/orbit/visibility';
import { Simulation } from '../core/simulation/Simulation';
import { AppStore } from '../core/state/AppStore';
import { flyToGeo, flyToObserver } from '../globe/cameraController';
import { createViewer } from '../globe/createViewer';
import { GlobeInteraction } from '../globe/GlobeInteraction';
import { ObserverLayer } from '../globe/layers/ObserverLayer';
import { OrbitPathLayer } from '../globe/layers/OrbitPathLayer';
import { SatelliteLayer } from '../globe/layers/SatelliteLayer';
import { showToast } from '../ui/components/Toast';
import { byId } from '../ui/dom';
import { mountUi, setLoading, showHoverTooltip } from '../ui/mountUi';
import type { AppContext } from './AppContext';

/**
 * Composition root: creates the store, simulation, globe layers and UI, and
 * drives the update loop from Cesium's clock.
 */
export class App implements AppContext {
  readonly store = new AppStore();
  readonly sim = new Simulation(this.store);
  readonly observerService = new ObserverService(this.store);

  private viewer!: Viewer;
  private satelliteLayer!: SatelliteLayer;
  private observerLayer!: ObserverLayer;
  private orbitLayer!: OrbitPathLayer;

  private lastStepRealMs = 0;
  private lastVisibilityRealMs = 0;
  private lastStepSimMs = 0;

  async start(): Promise<void> {
    this.viewer = createViewer(byId('globe'));
    this.satelliteLayer = new SatelliteLayer(this.viewer, this.store, this.sim);
    this.observerLayer = new ObserverLayer(this.viewer, this.store, this.sim);
    this.orbitLayer = new OrbitPathLayer(this.viewer, this.store, () => this.getSimDate());
    new GlobeInteraction(this.viewer, this.store, this.observerService, showHoverTooltip);

    mountUi(this);

    const refresh = () => this.refreshVisibility();
    this.store.bus.on('observer:changed', refresh);
    this.store.bus.on('mask:changed', refresh);

    this.observerService.restore();
    if (this.store.observer) flyToObserver(this.viewer, this.store.observer, 12_000_000);

    this.viewer.clock.onTick.addEventListener(() => this.onTick());
    await this.reloadCatalog(false);
  }

  // ---- AppContext -------------------------------------------------------

  getSimDate(): Date {
    return JulianDate.toDate(this.viewer.clock.currentTime);
  }

  isLive(): boolean {
    const { clock } = this.viewer;
    const drift = Math.abs(this.getSimDate().getTime() - Date.now());
    return clock.shouldAnimate && clock.multiplier === 1 && drift < 5000;
  }

  goLive(): void {
    const { clock } = this.viewer;
    clock.currentTime = JulianDate.now();
    clock.multiplier = 1;
    clock.shouldAnimate = true;
  }

  flyToObserver(): void {
    if (this.store.observer) flyToObserver(this.viewer, this.store.observer);
  }

  flyToSatellite(index: number): void {
    const geo = this.sim.getGeodetic(index);
    if (geo) flyToGeo(this.viewer, geo);
  }

  async reloadCatalog(forceRefresh: boolean): Promise<void> {
    const constellation = this.store.constellation;
    this.store.bus.emit('catalog:loading', { constellationId: constellation.id });
    if (this.store.records.length === 0) setLoading(true, `Loading ${constellation.name} catalog…`);

    try {
      const result = await loadConstellation(constellation, { forceRefresh });
      this.store.setCatalog(result.records, {
        constellationId: constellation.id,
        fetchedAt: result.fetchedAt,
        source: result.source,
        count: result.records.length,
      });
      this.stepSimulation(this.getSimDate());
      this.refreshVisibility();

      if (result.source === 'stale-cache') {
        showToast('Could not reach CelesTrak — showing the last downloaded data.', 'warning', 7000);
      } else if (forceRefresh) {
        showToast(`Loaded ${result.records.length.toLocaleString()} satellites.`, 'success', 2500);
      }
    } catch (err) {
      const message = (err as Error).message || 'Failed to load satellite data';
      this.store.bus.emit('catalog:error', { message });
      showToast(message, 'error', 10_000);
    } finally {
      setLoading(false);
    }
  }

  // ---- Update loop ------------------------------------------------------

  private onTick(): void {
    const realMs = performance.now();
    const date = this.getSimDate();
    const simMs = date.getTime();
    const jumped = Math.abs(simMs - this.lastStepSimMs) > SIM_JUMP_THRESHOLD_MS;

    if (!jumped && realMs - this.lastStepRealMs < SIM_STEP_INTERVAL_MS) return;
    this.lastStepRealMs = realMs;
    this.lastStepSimMs = simMs;
    this.stepSimulation(date);

    if (jumped || realMs - this.lastVisibilityRealMs >= VISIBILITY_INTERVAL_MS) {
      this.refreshVisibility();
    }
  }

  private stepSimulation(date: Date): void {
    if (this.store.records.length === 0) return;
    this.sim.step(date);
    this.satelliteLayer.update();
    this.observerLayer.updateLinks();
    this.orbitLayer.update(date);
    this.store.bus.emit('tick', { date });
  }

  private refreshVisibility(): void {
    this.lastVisibilityRealMs = performance.now();
    const observer = this.store.observer;
    if (!observer || !this.sim.ready) {
      if (this.store.visible.length) this.store.setVisible([]);
      return;
    }
    this.store.setVisible(computeVisible(this.sim, observer, this.store.elevationMaskDeg));
  }
}
