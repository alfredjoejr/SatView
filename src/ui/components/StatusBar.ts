import type { AppContext } from '../../app/AppContext';
import { formatCount, formatDateTime, timeAgo } from '../../utils/format';
import { byId, h, replaceChildren } from '../dom';

/** Bottom bar: catalog status, simulation clock, refresh & live controls. */
export class StatusBar {
  private readonly root = byId('statusbar');
  private readonly dataInfo = h('span', { class: 'status-data' });
  private readonly clock = h('span', { class: 'status-clock mono' });
  private readonly liveBtn: HTMLButtonElement;
  private readonly refreshBtn: HTMLButtonElement;
  private lastClockText = '';

  constructor(private readonly ctx: AppContext) {
    this.refreshBtn = h('button', { class: 'btn small', title: 'Download fresh orbital data', onclick: () => void this.refresh() }, '↻ Refresh data');
    this.liveBtn = h('button', { class: 'btn small live-btn', title: 'Jump back to real time', onclick: () => ctx.goLive() }, '● LIVE');

    replaceChildren(
      this.root,
      this.dataInfo,
      h('span', { class: 'status-spacer' }),
      this.clock,
      this.liveBtn,
      this.refreshBtn,
    );

    const { bus } = ctx.store;
    bus.on('catalog:loading', () => { this.dataInfo.textContent = 'Downloading orbital data…'; this.refreshBtn.disabled = true; });
    bus.on('catalog:loaded', () => { this.refreshBtn.disabled = false; this.renderData(); });
    bus.on('catalog:error', ({ message }) => { this.refreshBtn.disabled = false; this.dataInfo.textContent = `⚠ ${message}`; });
    bus.on('tick', ({ date }) => this.renderClock(date));
    setInterval(() => this.renderData(), 60_000);
  }

  private async refresh(): Promise<void> {
    await this.ctx.reloadCatalog(true);
  }

  private renderData(): void {
    const meta = this.ctx.store.catalogMeta;
    if (!meta) return;
    const name = this.ctx.store.constellation.name;
    const staleNote = meta.source === 'stale-cache' ? ' (offline copy)' : '';
    this.dataInfo.textContent = `${name}: ${formatCount(meta.count)} satellites · data ${timeAgo(meta.fetchedAt)}${staleNote} · CelesTrak`;
  }

  private renderClock(date: Date): void {
    const live = this.ctx.isLive();
    const text = formatDateTime(date);
    if (text !== this.lastClockText) {
      this.clock.textContent = text;
      this.lastClockText = text;
    }
    this.liveBtn.classList.toggle('is-live', live);
    this.liveBtn.textContent = live ? '● LIVE' : '↺ Back to live';
  }
}
