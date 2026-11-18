import { json2satrec, propagate, type OMMJsonObject } from 'satellite.js';
import { CATALOG_CACHE_TTL_MS } from '../../config/constants';
import type { ConstellationConfig } from '../../config/constellations';
import type { CatalogSource, SatelliteRecord } from '../types';
import { fetchGroupOmm, type OmmRecord } from './celestrakClient';
import { idbGet, idbSet } from './idbStore';

interface CachedCatalog {
  fetchedAt: number;
  records: OmmRecord[];
}

export interface CatalogLoadResult {
  records: SatelliteRecord[];
  fetchedAt: Date;
  source: CatalogSource;
}

export interface LoadOptions {
  /** Ignore a fresh cache and hit the network. */
  forceRefresh?: boolean;
}

/** Element sets older than this are almost certainly decayed / stale. */
const MAX_EPOCH_AGE_DAYS = 45;

const cacheKey = (c: ConstellationConfig) => `catalog:${c.id}`;

/**
 * Load a constellation catalog: fresh cache → network → stale cache fallback.
 */
export async function loadConstellation(
  constellation: ConstellationConfig,
  options: LoadOptions = {},
): Promise<CatalogLoadResult> {
  const cached = await idbGet<CachedCatalog>(cacheKey(constellation));
  const isFresh = cached && Date.now() - cached.fetchedAt < CATALOG_CACHE_TTL_MS;

  if (cached && isFresh && !options.forceRefresh) {
    return build(constellation, cached, 'cache');
  }

  try {
    const records = await fetchGroupOmm(constellation.celestrakGroup);
    if (records.length === 0) throw new Error('No satellites returned');
    const entry: CachedCatalog = { fetchedAt: Date.now(), records };
    await idbSet(cacheKey(constellation), entry);
    return build(constellation, entry, 'network');
  } catch (err) {
    if (cached) {
      console.warn('[catalog] network failed, using stale cache', err);
      return build(constellation, cached, 'stale-cache');
    }
    throw err;
  }
}

function build(constellation: ConstellationConfig, cached: CachedCatalog, source: CatalogSource): CatalogLoadResult {
  return {
    records: toSatelliteRecords(constellation, cached.records),
    fetchedAt: new Date(cached.fetchedAt),
    source,
  };
}

/** Parse OMM records into propagatable satellites, dropping broken/decayed ones. */
export function toSatelliteRecords(constellation: ConstellationConfig, omm: OmmRecord[]): SatelliteRecord[] {
  const now = new Date();
  const out: SatelliteRecord[] = [];

  for (const o of omm) {
    const epoch = new Date(o.EPOCH.endsWith('Z') ? o.EPOCH : `${o.EPOCH}Z`);
    if (Number.isNaN(epoch.getTime())) continue;
    if ((now.getTime() - epoch.getTime()) / 86_400_000 > MAX_EPOCH_AGE_DAYS) continue;

    let satrec;
    try {
      satrec = json2satrec(o as unknown as OMMJsonObject);
    } catch {
      continue;
    }
    // Sanity check: must propagate to "now".
    const pv = propagate(satrec, now);
    if (!pv || !Number.isFinite(pv.position.x)) continue;

    out.push({
      index: out.length,
      noradId: Number(o.NORAD_CAT_ID),
      name: o.OBJECT_NAME.trim(),
      intlDesignator: o.OBJECT_ID ?? '',
      constellationId: constellation.id,
      satrec,
      epoch,
      inclinationDeg: o.INCLINATION,
      periodMin: 1440 / o.MEAN_MOTION,
    });
  }
  return out;
}
