import {
  Cartographic,
  Math as CesiumMath,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  type Cartesian2,
  type Viewer,
} from 'cesium';
import type { AppStore } from '../core/state/AppStore';
import type { ObserverService } from '../core/observer/ObserverService';
import { isSatellitePickId } from './layers/SatelliteLayer';

const HOVER_THROTTLE_MS = 60;

export interface HoverInfo {
  text: string;
  x: number;
  y: number;
}

/**
 * Mouse interaction on the globe: click to select satellites, hover tooltips,
 * and "pick my location on the globe" mode.
 */
export class GlobeInteraction {
  private readonly handler: ScreenSpaceEventHandler;
  private lastHover = 0;

  constructor(
    private readonly viewer: Viewer,
    private readonly store: AppStore,
    private readonly observerService: ObserverService,
    private readonly onHover: (info: HoverInfo | null) => void,
  ) {
    this.handler = new ScreenSpaceEventHandler(viewer.scene.canvas);
    this.handler.setInputAction(
      (e: ScreenSpaceEventHandler.PositionedEvent) => this.handleClick(e.position),
      ScreenSpaceEventType.LEFT_CLICK,
    );
    this.handler.setInputAction(
      (e: ScreenSpaceEventHandler.MotionEvent) => this.handleMove(e.endPosition),
      ScreenSpaceEventType.MOUSE_MOVE,
    );
    store.bus.on('pickmode:changed', ({ active }) => {
      viewer.scene.canvas.style.cursor = active ? 'crosshair' : '';
    });
  }

  private handleClick(position: Cartesian2): void {
    if (this.store.pickLocationMode) {
      this.pickLocation(position);
      return;
    }
    const index = this.pickSatellite(position);
    if (index !== null) this.store.select(index);
  }

  private handleMove(position: Cartesian2): void {
    const now = performance.now();
    if (now - this.lastHover < HOVER_THROTTLE_MS) return;
    this.lastHover = now;

    if (this.store.pickLocationMode) return;
    const index = this.pickSatellite(position);
    const record = index !== null ? this.store.records[index] : null;
    this.viewer.scene.canvas.style.cursor = record ? 'pointer' : '';
    this.onHover(record ? { text: record.name, x: position.x, y: position.y } : null);
  }

  private pickSatellite(position: Cartesian2): number | null {
    const picked = this.viewer.scene.pick(position) as { id?: unknown } | undefined;
    return picked && isSatellitePickId(picked.id) ? picked.id.index : null;
  }

  private pickLocation(position: Cartesian2): void {
    const { camera, scene } = this.viewer;
    const cartesian = camera.pickEllipsoid(position, scene.globe.ellipsoid);
    if (!cartesian) return;
    const carto = Cartographic.fromCartesian(cartesian);
    const observer = this.observerService.createManual(
      CesiumMath.toDegrees(carto.latitude),
      CesiumMath.toDegrees(carto.longitude),
      'Picked location',
    );
    this.store.setObserver(observer);
    this.store.setPickMode(false);
  }

  destroy(): void {
    this.handler.destroy();
  }
}
