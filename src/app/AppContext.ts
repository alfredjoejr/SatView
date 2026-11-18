import type { ObserverService } from '../core/observer/ObserverService';
import type { Simulation } from '../core/simulation/Simulation';
import type { AppStore } from '../core/state/AppStore';

/**
 * The surface UI components are allowed to use. Keeps components decoupled
 * from Cesium and from the App class itself.
 */
export interface AppContext {
  readonly store: AppStore;
  readonly sim: Simulation;
  readonly observerService: ObserverService;

  /** Current simulation time (follows the timeline). */
  getSimDate(): Date;
  /** True when sim time tracks wall-clock time at 1x. */
  isLive(): boolean;
  goLive(): void;

  flyToObserver(): void;
  flyToSatellite(index: number): void;
  reloadCatalog(forceRefresh: boolean): Promise<void>;
}
