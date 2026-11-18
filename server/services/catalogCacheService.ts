import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  CACHE_DIR,
  CATALOG_TTL_MS,
  CELESTRAK_ORIGIN,
  REQUEST_TIMEOUT_MS,
} from '../config.ts';
import { HttpError } from '../httpUtils.ts';
import type { CatalogResponse, OmmRecord } from '../types.ts';

interface CachedEntry {
  fetchedAt: number;
  records: OmmRecord[];
}

const memoryCache = new Map<string, CachedEntry>();
const inFlight = new Map<string, Promise<CatalogResponse>>();

function sanitizeGroup(group: string): string {
  const normalized = group.trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(normalized)) {
    throw new HttpError(400, 'Invalid catalog group name');
  }
  return normalized;
}

function diskCachePath(group: string): string {
  return path.join(CACHE_DIR, `catalog-${group}.json`);
}

async function readDiskCache(group: string): Promise<CachedEntry | null> {
  try {
    const raw = await readFile(diskCachePath(group), 'utf8');
    const parsed = JSON.parse(raw) as Partial<CachedEntry>;
    if (typeof parsed.fetchedAt === 'number' && Array.isArray(parsed.records)) {
      return { fetchedAt: parsed.fetchedAt, records: parsed.records };
    }
    return null;
  } catch {
    return null;
  }
}

async function writeDiskCache(group: string, entry: CachedEntry): Promise<void> {
  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(diskCachePath(group), JSON.stringify(entry), 'utf8');
  } catch (err) {
    console.warn(`[catalogCache] failed to write disk cache for "${group}"`, err);
  }
}

function isOmmRecord(value: unknown): value is OmmRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<OmmRecord>;
  return typeof v.OBJECT_NAME === 'string' && typeof v.MEAN_MOTION === 'number' && typeof v.EPOCH === 'string';
}

async function fetchFromCelestrak(group: string): Promise<OmmRecord[]> {
  const url = `${CELESTRAK_ORIGIN}/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'SatView/0.1 (+https://github.com/alfredjoejr/SatView)' },
    });
    const body = await response.text();
    if (!response.ok) {
      throw new HttpError(502, `CelesTrak responded ${response.status}: ${body.slice(0, 120)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      throw new HttpError(502, `CelesTrak returned non-JSON: ${body.slice(0, 160) || 'empty response'}`);
    }
    if (!Array.isArray(data)) {
      throw new HttpError(502, 'CelesTrak returned an unexpected payload');
    }
    const valid = data.filter(isOmmRecord);
    if (valid.length === 0) {
      throw new HttpError(404, `No satellites returned for group "${group}"`);
    }
    return valid;
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new HttpError(504, 'Timed out downloading satellite data from CelesTrak');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function toResponse(
  group: string,
  entry: CachedEntry,
  source: CatalogResponse['source'],
): CatalogResponse {
  return {
    group,
    fetchedAt: new Date(entry.fetchedAt).toISOString(),
    source,
    count: entry.records.length,
    records: entry.records,
  };
}

/**
 * Load a constellation's OMM records from memory cache -> disk cache -> CelesTrak network.
 * Falls back to stale cache if upstream CelesTrak is unreachable.
 */
export async function getCatalog(group: string, forceRefresh = false): Promise<CatalogResponse> {
  const cleanGroup = sanitizeGroup(group);

  let cached = memoryCache.get(cleanGroup) ?? null;
  if (!cached) {
    cached = await readDiskCache(cleanGroup);
    if (cached) memoryCache.set(cleanGroup, cached);
  }

  const isFresh = cached !== null && Date.now() - cached.fetchedAt < CATALOG_TTL_MS;
  if (cached && isFresh && !forceRefresh) {
    return toResponse(cleanGroup, cached, 'cache');
  }

  const existingRequest = inFlight.get(cleanGroup);
  if (existingRequest) return existingRequest;

  const job = (async (): Promise<CatalogResponse> => {
    try {
      const records = await fetchFromCelestrak(cleanGroup);
      const freshEntry: CachedEntry = { fetchedAt: Date.now(), records };
      memoryCache.set(cleanGroup, freshEntry);
      await writeDiskCache(cleanGroup, freshEntry);
      return toResponse(cleanGroup, freshEntry, 'network');
    } catch (err) {
      if (cached) {
        console.warn(`[catalogCache] upstream failed for "${cleanGroup}", serving stale cache`, err);
        return toResponse(cleanGroup, cached, 'stale-cache');
      }
      throw err;
    } finally {
      inFlight.delete(cleanGroup);
    }
  })();

  inFlight.set(cleanGroup, job);
  return job;
}
