import {
  Cartesian3,
  Color,
  NearFarScalar,
  PointPrimitiveCollection,
  type PointPrimitive,
  type Viewer,
} from 'cesium';
import { COLORS } from '../../config/constants';
import type { AppStore } from '../../core/state/AppStore';
import type { Simulation } from '../../core/simulation/Simulation';
import type { VisibleSatellite } from '../../core/types';

/** Attached to every satellite point so picking can resolve it. */
export interface SatellitePickId {
  kind: 'satellite';
  index: number;
}

export function isSatellitePickId(value: unknown): value is SatellitePickId {
  return typeof value === 'object' && value !== null && (value as SatellitePickId).kind === 'satellite';
}

const STYLE = {
  base: { color: Color.fromCssColorString(COLORS.satellite).withAlpha(0.8), size: 3 },
  visible: { color: Color.fromCssColorString(COLORS.visible), size: 6 },
  selected: { color: Color.fromCssColorString(COLORS.selected), size: 11 },
};

/**
 * Renders the whole constellation as GPU point primitives (fast enough for
 * 10k+ satellites) and highlights visible/selected ones.
 */
export class SatelliteLayer {
  private readonly collection: PointPrimitiveCollection;
  private points: PointPrimitive[] = [];
  private visible = new Set<number>();
  private selected: number | null = null;
  private readonly scratch = new Cartesian3();

  constructor(
    viewer: Viewer,
    private readonly store: AppStore,
    private readonly sim: Simulation,
  ) {
    this.collection = viewer.scene.primitives.add(new PointPrimitiveCollection());

    store.bus.on('catalog:loaded', () => this.rebuild());
    store.bus.on('selection:changed', ({ index }) => {
      const previous = this.selected;
      this.selected = index;
      if (previous !== null) this.applyStyle(previous);
      if (index !== null) this.applyStyle(index);
    });
    store.bus.on('visibility:updated', ({ visible }) => this.setVisible(visible));
  }

  /** Copy the latest simulated positions into the GPU points. */
  update(): void {
    const { ecf, valid } = this.sim;
    const count = Math.min(this.points.length, valid.length);
    const s = this.scratch;

    for (let i = 0; i < count; i++) {
      const point = this.points[i];
      if (!valid[i]) {
        if (point.show) point.show = false;
        continue;
      }
      const o = i * 3;
      s.x = ecf[o] * 1000;
      s.y = ecf[o + 1] * 1000;
      s.z = ecf[o + 2] * 1000;
      point.position = s;
      if (!point.show) point.show = true;
    }
  }

  private rebuild(): void {
    this.collection.removeAll();
    this.visible.clear();
    this.selected = this.store.selectedIndex;
    const scale = new NearFarScalar(5.0e5, 2.0, 3.0e7, 0.8);

    this.points = this.store.records.map((record) =>
      this.collection.add({
        position: Cartesian3.ZERO,
        pixelSize: STYLE.base.size,
        color: STYLE.base.color,
        scaleByDistance: scale,
        show: false,
        id: { kind: 'satellite', index: record.index } satisfies SatellitePickId,
      }),
    );
  }

  private setVisible(list: VisibleSatellite[]): void {
    const next = new Set(list.map((v) => v.index));
    const previous = this.visible;
    this.visible = next;
    for (const i of previous) if (!next.has(i)) this.applyStyle(i);
    for (const i of next) if (!previous.has(i)) this.applyStyle(i);
  }

  private applyStyle(index: number): void {
    const point = this.points[index];
    if (!point) return;
    if (index === this.selected) {
      point.color = STYLE.selected.color;
      point.pixelSize = STYLE.selected.size;
      point.outlineColor = Color.BLACK;
      point.outlineWidth = 2;
    } else if (this.visible.has(index)) {
      point.color = STYLE.visible.color;
      point.pixelSize = STYLE.visible.size;
      point.outlineWidth = 0;
    } else {
      point.color = STYLE.base.color;
      point.pixelSize = STYLE.base.size;
      point.outlineWidth = 0;
    }
  }
}
