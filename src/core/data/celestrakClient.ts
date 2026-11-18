import { CELESTRAK_BASE_URL } from '../../config/constants';
import type { CatalogSource } from '../types';

/**
 * Orbit Mean-elements Message (OMM) record as returned by CelesTrak's
 * GP API in JSON format. OMM is used instead of legacy TLE text because it
 * supports 6+ digit catalog numbers.
 */
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

export interface BackendCatalogPayload {
  group: string;
  fetchedAt: Date;
  source: CatalogSource;
  records: OmmRecord[];
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Fetch an OMM catalog from the SatView backend API (cached on disk/memory). */
export async function fetchCatalogFromBackend(
  group: string,
  forceRefresh = false,
): Promise<BackendCatalogPayload> {
  const qs = forceRefresh ? '?refresh=1' : '';
  const url = `/api/catalog/${encodeURIComponent(group)}${qs}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`Backend responded ${response.status}: ${body.slice(0, 120)}`);
    }
    const parsed = JSON.parse(body) as {
      group?: unknown;
      fetchedAt?: unknown;
      source?: unknown;
      records?: unknown;
    };
    if (!Array.isArray(parsed.records)) {
      throw new Error('Backend returned an unexpected catalog payload');
    }
    const fetchedAt = new Date(typeof parsed.fetchedAt === 'string' ? parsed.fetchedAt : Date.now());
    const source: CatalogSource =
      parsed.source === 'stale-cache' || parsed.source === 'cache' || parsed.source === 'network'
        ? parsed.source
        : 'network';
    return {
      group: typeof parsed.group === 'string' ? parsed.group : group,
      fetchedAt: Number.isNaN(fetchedAt.getTime()) ? new Date() : fetchedAt,
      source,
      records: parsed.records.filter(isOmmRecord),
    };
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Timed out downloading satellite catalog');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/** Direct fallback against CelesTrak when running without the backend server. */
export async function fetchGroupOmm(group: string): Promise<OmmRecord[]> {
  const url = `${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`CelesTrak responded ${response.status}: ${body.slice(0, 120)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      // CelesTrak returns plain text for errors / rate limits.
      throw new Error(`CelesTrak: ${body.slice(0, 160) || 'empty response'}`);
    }
    if (!Array.isArray(data)) throw new Error('CelesTrak returned an unexpected payload');
    return data.filter(isOmmRecord);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Timed out downloading satellite data from CelesTrak');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isOmmRecord(value: unknown): value is OmmRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<OmmRecord>;
  return typeof v.OBJECT_NAME === 'string' && typeof v.MEAN_MOTION === 'number' && typeof v.EPOCH === 'string';
}
