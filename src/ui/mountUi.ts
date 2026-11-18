import type { AppContext } from '../app/AppContext';
import type { HoverInfo } from '../globe/GlobeInteraction';
import { DishGuide } from './components/DishGuide';
import { Header } from './components/Header';
import { LocationPanel } from './components/LocationPanel';
import { SatelliteInfoPanel } from './components/SatelliteInfoPanel';
import { SkyPlot } from './components/SkyPlot';
import { StatusBar } from './components/StatusBar';
import { Topbar } from './components/Topbar';
import { VisibleList } from './components/VisibleList';
import { byId, replaceChildren } from './dom';

/** Build all UI components into the static skeleton defined in index.html. */
export function mountUi(ctx: AppContext): void {
  replaceChildren(
    byId('sidebar'),
    new Header(ctx).el,
    new LocationPanel(ctx).el,
    new SkyPlot(ctx).el,
    new DishGuide(ctx).el,
    new VisibleList(ctx).el,
  );
  new Topbar(ctx);
  new StatusBar(ctx);
  new SatelliteInfoPanel(ctx);
}

/** Tooltip shown when hovering a satellite on the globe. */
export function showHoverTooltip(info: HoverInfo | null): void {
  const tooltip = byId('tooltip');
  if (!info) {
    tooltip.hidden = true;
    return;
  }
  tooltip.textContent = info.text;
  tooltip.style.transform = `translate(${info.x + 14}px, ${info.y + 14}px)`;
  tooltip.hidden = false;
}

export function setLoading(visible: boolean, message?: string): void {
  const overlay = byId('loading');
  overlay.classList.toggle('hidden', !visible);
  if (message) {
    const p = overlay.querySelector('p');
    if (p) p.textContent = message;
  }
}
