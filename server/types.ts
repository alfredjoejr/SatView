/** Orbit Mean-elements Message (OMM) record from CelesTrak GP JSON API. */
export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

export type ServerCatalogSource = 'network' | 'cache' | 'stale-cache';

export interface CatalogResponse {
  group: string;
  fetchedAt: string;
  source: ServerCatalogSource;
  count: number;
  records: OmmRecord[];
}

export interface ObserverInput {
  latDeg: number;
  lonDeg: number;
  altM: number;
}

export interface ServerLookAngle {
  azDeg: number;
  elDeg: number;
  rangeKm: number;
}

export interface ServerVisibleItem {
  noradId: number;
  name: string;
  intlDesignator: string;
  latDeg: number;
  lonDeg: number;
  altKm: number;
  look: ServerLookAngle;
}

export interface ServerVisibleResponse {
  group: string;
  timestamp: string;
  maskDeg: number;
  count: number;
  totalCatalog: number;
  visible: ServerVisibleItem[];
}

export interface ServerSkyCoverageResponse {
  sectorCount: number;
  sectorHits: number[];
  sectorAvgElDeg: (number | null)[];
  bestAzDeg: number;
  bestSpanDeg: number;
  bestSectors: number[];
  bestAvgElDeg: number | null;
  avgVisibleCount: number;
  windowMinutes: number;
  computedAt: string;
}

export interface ServerPassResponse {
  noradId: number;
  name: string;
  aos: string;
  los: string;
  maxElDeg: number;
  maxElTime: string;
  aosAzDeg: number;
  losAzDeg: number;
}
