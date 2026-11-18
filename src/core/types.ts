import type { SatRec } from 'satellite.js';

/** One tracked object with its parsed orbital elements. */
export interface SatelliteRecord {
  /** Position in the active catalog array (stable until the catalog reloads). */
  index: number;
  noradId: number;
  name: string;
  /** International designator, e.g. "2019-074A". */
  intlDesignator: string;
  constellationId: string;
  satrec: SatRec;
  /** Epoch of the element set. */
  epoch: Date;
  inclinationDeg: number;
  periodMin: number;
}

export interface GeoPosition {
  latDeg: number;
  lonDeg: number;
  altKm: number;
}

export type ObserverSource = 'gps' | 'manual';

export interface ObserverLocation {
  latDeg: number;
  lonDeg: number;
  altM: number;
  label: string;
  source: ObserverSource;
  accuracyM?: number;
}

/** Topocentric direction from the observer to a satellite. */
export interface LookAngle {
  /** Degrees clockwise from true north. */
  azDeg: number;
  /** Degrees above the horizon. */
  elDeg: number;
  rangeKm: number;
}

export interface VisibleSatellite {
  index: number;
  look: LookAngle;
}

export type CatalogSource = 'network' | 'cache' | 'stale-cache';

export interface CatalogMeta {
  constellationId: string;
  fetchedAt: Date;
  source: CatalogSource;
  count: number;
}

export interface SatellitePass {
  aos: Date;
  los: Date;
  maxElDeg: number;
  maxElTime: Date;
  aosAzDeg: number;
  losAzDeg: number;
}

/** Result of the dish-positioning sky analysis. */
export interface SkyCoverage {
  sectorCount: number;
  /** Satellite-samples per azimuth sector. */
  sectorHits: number[];
  /** Average elevation per sector (deg), NaN when empty. */
  sectorAvgElDeg: number[];
  /** Center azimuth of the densest window of sectors. */
  bestAzDeg: number;
  /** Angular width of that window. */
  bestSpanDeg: number;
  /** Indices of sectors in the best window. */
  bestSectors: number[];
  bestAvgElDeg: number;
  avgVisibleCount: number;
  windowMinutes: number;
  computedAt: Date;
}
