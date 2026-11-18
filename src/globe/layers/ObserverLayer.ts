import {
  Cartesian2,
  Cartesian3,
  Color,
  HorizontalOrigin,
  LabelStyle,
  Material,
  PolylineCollection,
  VerticalOrigin,
  type Entity,
  type Polyline,
  type Viewer,
} from 'cesium';
import { COLORS, MAX_LINK_LINES } from '../../config/constants';
import type { AppStore } from '../../core/state/AppStore';
import type { Simulation } from '../../core/simulation/Simulation';
import { coverageRadiusKm } from '../../utils/geo';

const LINK_MATERIAL = Material.fromType('Color', { color: Color.fromCssColorString(COLORS.link).withAlpha(0.45) });
const SELECTED_LINK_MATERIAL = Material.fromType('Color', { color: Color.fromCssColorString(COLORS.selected) });

/**
 * Draws the observer marker, the coverage footprint (area of sky usable above
 * the elevation mask, projected at shell altitude) and live link lines to the
 * satellites currently overhead.
 */
export class ObserverLayer {
  private marker: Entity | null = null;
  private footprint: Entity | null = null;
  private readonly links: PolylineCollection;
  private linkPolylines: Polyline[] = [];
  private linkIndices: number[] = [];
  private observerCartesian: Cartesian3 | null = null;

  constructor(
    private readonly viewer: Viewer,
    private readonly store: AppStore,
    private readonly sim: Simulation,
  ) {
    this.links = viewer.scene.primitives.add(new PolylineCollection());

    store.bus.on('observer:changed', () => this.renderObserver());
    store.bus.on('mask:changed', () => this.renderObserver());
    store.bus.on('catalog:loaded', () => this.renderObserver());
    store.bus.on('visibility:updated', ({ visible }) => {
      const indices = visible.slice(0, MAX_LINK_LINES).map((v) => v.index);
      const sel = store.selectedIndex;
      if (sel !== null && !indices.includes(sel) && visible.some((v) => v.index === sel)) indices.push(sel);
      this.setLinks(indices);
    });
    store.bus.on('selection:changed', () => this.setLinks(this.linkIndices, true));
  }

  /** Move link endpoints to the latest satellite positions. Call every sim step. */
  updateLinks(): void {
    if (!this.observerCartesian) return;
    const { ecf, valid } = this.sim;
    for (let k = 0; k < this.linkPolylines.length; k++) {
      const i = this.linkIndices[k];
      const line = this.linkPolylines[k];
      if (!valid[i]) { line.show = false; continue; }
      const o = i * 3;
      // Polyline keeps a reference to the array, so each line needs its own Cartesian3.
      const satPosition = new Cartesian3(ecf[o] * 1000, ecf[o + 1] * 1000, ecf[o + 2] * 1000);
      line.positions = [this.observerCartesian, satPosition];
      line.show = true;
    }
  }

  private renderObserver(): void {
    const { entities } = this.viewer;
    if (this.marker) entities.remove(this.marker);
    if (this.footprint) entities.remove(this.footprint);
    this.marker = this.footprint = null;

    const observer = this.store.observer;
    if (!observer) {
      this.observerCartesian = null;
      this.setLinks([]);
      return;
    }

    this.observerCartesian = Cartesian3.fromDegrees(observer.lonDeg, observer.latDeg, observer.altM);
    const observerColor = Color.fromCssColorString(COLORS.observer);

    this.marker = entities.add({
      position: this.observerCartesian,
      point: { pixelSize: 12, color: observerColor, outlineColor: Color.WHITE, outlineWidth: 2 },
      label: {
        text: observer.label,
        font: '600 13px Inter, system-ui, sans-serif',
        style: LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 3,
        outlineColor: Color.BLACK,
        fillColor: Color.WHITE,
        horizontalOrigin: HorizontalOrigin.LEFT,
        verticalOrigin: VerticalOrigin.CENTER,
        pixelOffset: new Cartesian2(12, 0),
      },
    });

    const shellKm = this.store.constellation.shellAltitudeKm;
    const radiusM = coverageRadiusKm(this.store.elevationMaskDeg, shellKm) * 1000;
    if (Number.isFinite(radiusM) && radiusM > 0) {
      this.footprint = entities.add({
        position: Cartesian3.fromDegrees(observer.lonDeg, observer.latDeg, shellKm * 1000),
        ellipse: {
          semiMajorAxis: radiusM,
          semiMinorAxis: radiusM,
          height: shellKm * 1000,
          material: Color.fromCssColorString(COLORS.coverage).withAlpha(0.08),
          outline: true,
          outlineColor: Color.fromCssColorString(COLORS.coverage).withAlpha(0.6),
        },
      });
    }
  }

  private setLinks(indices: number[], forceRestyle = false): void {
    const changed = forceRestyle || indices.length !== this.linkIndices.length
      || indices.some((v, k) => v !== this.linkIndices[k]);
    this.linkIndices = this.observerCartesian ? indices : [];
    if (!changed) return;

    while (this.linkPolylines.length > this.linkIndices.length) {
      this.links.remove(this.linkPolylines.pop()!);
    }
    while (this.linkPolylines.length < this.linkIndices.length) {
      this.linkPolylines.push(this.links.add({ positions: [], width: 1, material: LINK_MATERIAL, show: false }));
    }
    const sel = this.store.selectedIndex;
    this.linkIndices.forEach((index, k) => {
      const line = this.linkPolylines[k];
      const isSelected = index === sel;
      line.material = isSelected ? SELECTED_LINK_MATERIAL : LINK_MATERIAL;
      line.width = isSelected ? 2.5 : 1;
    });
    this.updateLinks();
  }
}
