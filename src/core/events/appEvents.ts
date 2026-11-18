import type { CatalogMeta, ObserverLocation, SkyCoverage, VisibleSatellite } from '../types';

/** Every event that flows through the app bus. */
export type AppEvents = {
  'catalog:loading': { constellationId: string };
  'catalog:loaded': CatalogMeta;
  'catalog:error': { message: string };
  tick: { date: Date };
  'visibility:updated': { visible: VisibleSatellite[] };
  'selection:changed': { index: number | null };
  'observer:changed': { observer: ObserverLocation | null };
  'mask:changed': { maskDeg: number };
  'coverage:updated': { coverage: SkyCoverage | null };
  'pickmode:changed': { active: boolean };
};
