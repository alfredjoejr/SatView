import type { AppContext } from '../../app/AppContext';
import { COLORS } from '../../config/constants';
import { drawPolarGrid, fillSector, polarToXY, setupHiDpiCanvas, strokeElevationRing, type PolarFrame } from '../canvas/polar';
import { h } from '../dom';
import { createPanel } from './Panel';

const SIZE = 260;
const PADDING = 20;
const CLICK_RADIUS_PX = 12;

/**
 * Live polar plot of the sky above the observer: center = straight up,
 * edge = horizon, north at the top. Mirrors what a dish "sees".
 */
export class SkyPlot {
  readonly el: HTMLElement;
  private readonly canvas = h('canvas', { class: 'skyplot', 'aria-label': 'Sky plot of satellites above you' });
  private readonly ctx2d: CanvasRenderingContext2D;
  private readonly caption = h('p', { class: 'muted small center' });
  private readonly frame: PolarFrame = { cx: SIZE / 2, cy: SIZE / 2, r: SIZE / 2 - PADDING };
  private drawn: { index: number; x: number; y: number }[] = [];

  constructor(private readonly ctx: AppContext) {
    this.ctx2d = setupHiDpiCanvas(this.canvas, SIZE);
    this.canvas.addEventListener('click', (e) => this.handleClick(e));

    const body = h('div', { class: 'skyplot-wrap' }, this.canvas, this.caption);
    this.el = createPanel(body, { title: 'Sky above you', collapsible: true });

    const redraw = () => this.draw();
    const { bus } = ctx.store;
    bus.on('visibility:updated', redraw);
    bus.on('selection:changed', redraw);
    bus.on('coverage:updated', redraw);
    bus.on('mask:changed', redraw);
    bus.on('observer:changed', redraw);
    this.draw();
  }

  private draw(): void {
    const c = this.ctx2d;
    const f = this.frame;
    const { store } = this.ctx;
    c.clearRect(0, 0, SIZE, SIZE);
    drawPolarGrid(c, f);

    const coverage = store.coverage;
    if (coverage) {
      const size = 360 / coverage.sectorCount;
      const max = Math.max(1, ...coverage.sectorHits);
      coverage.sectorHits.forEach((hits, i) => {
        const alpha = 0.05 + 0.35 * (hits / max);
        fillSector(c, f, i * size, (i + 1) * size, store.elevationMaskDeg, 90, `rgba(61, 220, 151, ${alpha.toFixed(3)})`);
      });
    }

    strokeElevationRing(c, f, store.elevationMaskDeg, 'rgba(255, 209, 102, 0.8)');

    this.drawn = [];
    const selected = store.selectedIndex;
    for (const v of store.visible) {
      const p = polarToXY(f, v.look.azDeg, v.look.elDeg);
      this.drawn.push({ index: v.index, x: p.x, y: p.y });
      if (v.index === selected) continue;
      c.fillStyle = COLORS.visible;
      c.beginPath();
      c.arc(p.x, p.y, 3.5, 0, Math.PI * 2);
      c.fill();
    }
    const sel = store.visible.find((v) => v.index === selected);
    if (sel) {
      const p = polarToXY(f, sel.look.azDeg, sel.look.elDeg);
      c.fillStyle = COLORS.selected;
      c.strokeStyle = '#000';
      c.lineWidth = 2;
      c.beginPath();
      c.arc(p.x, p.y, 6, 0, Math.PI * 2);
      c.fill();
      c.stroke();
    }

    if (!store.observer) this.caption.textContent = 'Set your location to see the sky.';
    else this.caption.textContent = `${store.visible.length} satellites above ${store.elevationMaskDeg}° · click a dot to select`;
  }

  private handleClick(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * SIZE;
    const y = ((e.clientY - rect.top) / rect.height) * SIZE;
    let best: number | null = null;
    let bestDist = CLICK_RADIUS_PX;
    for (const d of this.drawn) {
      const dist = Math.hypot(d.x - x, d.y - y);
      if (dist < bestDist) { bestDist = dist; best = d.index; }
    }
    if (best !== null) this.ctx.store.select(best);
  }
}
