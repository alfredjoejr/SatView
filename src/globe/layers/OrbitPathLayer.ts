import {
  ArcType,
  Cartesian3,
  Color,
  PolylineGlowMaterialProperty,
  type Entity,
  type Viewer,
} from 'cesium';
import { COLORS } from '../../config/constants';
import type { AppStore } from '../../core/state/AppStore';
import { propagateState } from '../../core/orbit/propagator';

const SAMPLES_PER_ORBIT = 240;
/** Recompute the path when sim time drifts this far from the last computation. */
const RECOMPUTE_AFTER_MS = 60_000;

/** Draws one full orbit (Earth-fixed frame) for the selected satellite. */
export class OrbitPathLayer {
  private entity: Entity | null = null;
  private lastComputedFor: number | null = null;

  constructor(
    private readonly viewer: Viewer,
    private readonly store: AppStore,
    private readonly getDate: () => Date,
  ) {
    store.bus.on('selection:changed', () => this.recompute(this.getDate()));
    store.bus.on('catalog:loaded', () => this.clear());
  }

  update(date: Date): void {
    if (this.store.selectedIndex === null || this.lastComputedFor === null) return;
    if (Math.abs(date.getTime() - this.lastComputedFor) > RECOMPUTE_AFTER_MS) this.recompute(date);
  }

  private recompute(date: Date): void {
    this.clear();
    const record = this.store.selectedRecord;
    if (!record) return;

    const periodMs = record.periodMin * 60_000;
    const positions: Cartesian3[] = [];
    for (let k = 0; k <= SAMPLES_PER_ORBIT; k++) {
      const t = new Date(date.getTime() + (k / SAMPLES_PER_ORBIT - 0.5) * periodMs);
      const state = propagateState(record.satrec, t);
      if (state) positions.push(new Cartesian3(state.ecf.x * 1000, state.ecf.y * 1000, state.ecf.z * 1000));
    }
    if (positions.length < 2) return;

    this.entity = this.viewer.entities.add({
      polyline: {
        positions,
        width: 4,
        arcType: ArcType.NONE,
        material: new PolylineGlowMaterialProperty({
          glowPower: 0.25,
          color: Color.fromCssColorString(COLORS.orbit).withAlpha(0.8),
        }),
      },
    });
    this.lastComputedFor = date.getTime();
  }

  private clear(): void {
    if (this.entity) this.viewer.entities.remove(this.entity);
    this.entity = null;
    this.lastComputedFor = null;
  }
}
