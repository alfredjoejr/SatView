import { degreesToRadians, gstime, propagate } from 'satellite.js';
import type { ObserverLocation, SatelliteRecord, SkyCoverage } from '../types';
import { yieldToBrowser } from '../../utils/async';
import { approxSinElevation, createObserverFrame, lookAngleFromEcf } from './lookAngles';

export interface CoverageOptions {
  group?: string;
  windowMinutes: number;
  stepSeconds: number;
  sectorCount: number;
  /** Number of adjacent sectors that form the recommended "clear view" window. */
  windowSectors?: number;
  onProgress?: (fraction: number) => void;
}

interface BackendCoverageJson {
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

async function fetchBackendCoverage(
  group: string,
  observer: ObserverLocation,
  maskDeg: number,
  start: Date,
  options: CoverageOptions,
): Promise<SkyCoverage> {
  const params = new URLSearchParams({
    group,
    lat: String(observer.latDeg),
    lon: String(observer.lonDeg),
    altM: String(observer.altM),
    maskDeg: String(maskDeg),
    windowMinutes: String(options.windowMinutes),
    stepSeconds: String(options.stepSeconds),
    sectorCount: String(options.sectorCount),
    time: start.toISOString(),
  });
  const response = await fetch(`/api/observer/coverage?${params.toString()}`);
  if (!response.ok) throw new Error(`Coverage API returned ${response.status}`);
  const data = (await response.json()) as BackendCoverageJson;
  options.onProgress?.(1);
  return {
    sectorCount: data.sectorCount,
    sectorHits: data.sectorHits,
    sectorAvgElDeg: data.sectorAvgElDeg.map((v) => (v === null ? Number.NaN : v)),
    bestAzDeg: data.bestAzDeg,
    bestSpanDeg: data.bestSpanDeg,
    bestSectors: data.bestSectors,
    bestAvgElDeg: data.bestAvgElDeg === null ? Number.NaN : data.bestAvgElDeg,
    avgVisibleCount: data.avgVisibleCount,
    windowMinutes: data.windowMinutes,
    computedAt: new Date(data.computedAt),
  };
}

/**
 * Sample the sky over the next N minutes and count, per azimuth sector, how
 * many satellites are above the elevation mask. Uses the SatView backend API
 * first, falling back to local browser computation when offline.
 */
export async function analyzeCoverage(
  records: readonly SatelliteRecord[],
  observer: ObserverLocation,
  maskDeg: number,
  start: Date,
  options: CoverageOptions,
): Promise<SkyCoverage> {
  if (options.group) {
    try {
      options.onProgress?.(0.25);
      return await fetchBackendCoverage(options.group, observer, maskDeg, start, options);
    } catch (err) {
      console.warn('[coverage] backend unavailable, computing locally', err);
    }
  }

  const { windowMinutes, stepSeconds, sectorCount, onProgress } = options;
  const windowSectors = Math.min(options.windowSectors ?? 3, sectorCount);
  const frame = createObserverFrame(observer);
  const minSin = Math.sin(degreesToRadians(maskDeg - 1.5));
  const sectorSize = 360 / sectorCount;

  const hits = new Array<number>(sectorCount).fill(0);
  const elSum = new Array<number>(sectorCount).fill(0);
  const samples = Math.max(1, Math.floor((windowMinutes * 60) / stepSeconds));
  const ecf = { x: 0, y: 0, z: 0 };
  let totalVisible = 0;

  for (let s = 0; s < samples; s++) {
    const date = new Date(start.getTime() + s * stepSeconds * 1000);
    const gmst = gstime(date);
    const cos = Math.cos(gmst);
    const sin = Math.sin(gmst);

    for (const rec of records) {
      const pv = propagate(rec.satrec, date);
      if (!pv || !Number.isFinite(pv.position.x)) continue;
      const p = pv.position;
      // ECI → ECF rotation inlined for speed.
      ecf.x = p.x * cos + p.y * sin;
      ecf.y = -p.x * sin + p.y * cos;
      ecf.z = p.z;
      if (approxSinElevation(frame, ecf.x, ecf.y, ecf.z) < minSin) continue;
      const look = lookAngleFromEcf(frame, ecf);
      if (look.elDeg < maskDeg) continue;
      const sector = Math.floor(look.azDeg / sectorSize) % sectorCount;
      hits[sector]++;
      elSum[sector] += look.elDeg;
      totalVisible++;
    }

    onProgress?.((s + 1) / samples);
    await yieldToBrowser();
  }

  const best = findBestWindow(hits, windowSectors);
  const bestHits = best.reduce((acc, i) => acc + hits[i], 0);
  const bestElSum = best.reduce((acc, i) => acc + elSum[i], 0);

  return {
    sectorCount,
    sectorHits: hits,
    sectorAvgElDeg: hits.map((h, i) => (h ? elSum[i] / h : Number.NaN)),
    bestAzDeg: weightedCenterAz(best, hits, sectorSize),
    bestSpanDeg: windowSectors * sectorSize,
    bestSectors: best,
    bestAvgElDeg: bestHits ? bestElSum / bestHits : Number.NaN,
    avgVisibleCount: totalVisible / samples,
    windowMinutes,
    computedAt: new Date(),
  };
}

/** Indices of the `width` consecutive (circular) sectors with the most hits. */
function findBestWindow(hits: number[], width: number): number[] {
  const n = hits.length;
  let bestStart = 0;
  let bestSum = -1;
  for (let s = 0; s < n; s++) {
    let sum = 0;
    for (let k = 0; k < width; k++) sum += hits[(s + k) % n];
    if (sum > bestSum) { bestSum = sum; bestStart = s; }
  }
  return Array.from({ length: width }, (_, k) => (bestStart + k) % n);
}

/** Circular mean of sector centers, weighted by hit counts. */
function weightedCenterAz(sectors: number[], hits: number[], sectorSize: number): number {
  let x = 0;
  let y = 0;
  for (const i of sectors) {
    const az = degreesToRadians(i * sectorSize + sectorSize / 2);
    const w = hits[i] || 1e-6;
    x += Math.sin(az) * w;
    y += Math.cos(az) * w;
  }
  return ((Math.atan2(x, y) * 180) / Math.PI + 360) % 360;
}
