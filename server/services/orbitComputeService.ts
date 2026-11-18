import {
  degreesLat,
  degreesLong,
  degreesToRadians,
  ecfToLookAngles,
  eciToEcf,
  eciToGeodetic,
  geodeticToEcf,
  gstime,
  json2satrec,
  propagate,
  radiansToDegrees,
  type EcfVec3,
  type GeodeticLocation,
  type OMMJsonObject,
  type SatRec,
} from 'satellite.js';
import { MAX_EPOCH_AGE_DAYS } from '../config.ts';
import type {
  ObserverInput,
  OmmRecord,
  ServerLookAngle,
  ServerPassResponse,
  ServerSkyCoverageResponse,
  ServerVisibleItem,
  ServerVisibleResponse,
} from '../types.ts';

interface CompiledSat {
  noradId: number;
  name: string;
  intlDesignator: string;
  satrec: SatRec;
}

interface ObserverFrame {
  geodetic: GeodeticLocation;
  ecf: EcfVec3<number>;
  up: EcfVec3<number>;
}

const compiledCache = new Map<string, { fetchedAt: string; sats: CompiledSat[] }>();

function getCompiledCatalog(group: string, fetchedAt: string, records: OmmRecord[]): CompiledSat[] {
  const cached = compiledCache.get(group);
  if (cached && cached.fetchedAt === fetchedAt) return cached.sats;

  const nowMs = Date.now();
  const sats: CompiledSat[] = [];

  for (const o of records) {
    const epoch = new Date(o.EPOCH.endsWith('Z') ? o.EPOCH : `${o.EPOCH}Z`);
    if (Number.isNaN(epoch.getTime())) continue;
    if ((nowMs - epoch.getTime()) / 86_400_000 > MAX_EPOCH_AGE_DAYS) continue;

    try {
      const satrec = json2satrec(o as unknown as OMMJsonObject);
      sats.push({
        noradId: Number(o.NORAD_CAT_ID),
        name: o.OBJECT_NAME.trim(),
        intlDesignator: o.OBJECT_ID ?? '',
        satrec,
      });
    } catch {
      // Skip malformed element sets.
    }
  }

  compiledCache.set(group, { fetchedAt, sats });
  return sats;
}

function createObserverFrame(observer: ObserverInput): ObserverFrame {
  const geodetic: GeodeticLocation = {
    latitude: degreesToRadians(observer.latDeg),
    longitude: degreesToRadians(observer.lonDeg),
    height: observer.altM / 1000,
  };
  const ecf = geodeticToEcf(geodetic);
  const len = Math.hypot(ecf.x, ecf.y, ecf.z);
  return { geodetic, ecf, up: { x: ecf.x / len, y: ecf.y / len, z: ecf.z / len } };
}

function approxSinElevation(frame: ObserverFrame, x: number, y: number, z: number): number {
  const dx = x - frame.ecf.x;
  const dy = y - frame.ecf.y;
  const dz = z - frame.ecf.z;
  return (dx * frame.up.x + dy * frame.up.y + dz * frame.up.z) / Math.hypot(dx, dy, dz);
}

function lookAngleFromEcf(frame: ObserverFrame, satEcf: EcfVec3<number>): ServerLookAngle {
  const look = ecfToLookAngles(frame.geodetic, satEcf);
  return {
    azDeg: (radiansToDegrees(look.azimuth) + 360) % 360,
    elDeg: radiansToDegrees(look.elevation),
    rangeKm: look.rangeSat,
  };
}

function lookAngleAt(satrec: SatRec, frame: ObserverFrame, date: Date): ServerLookAngle | null {
  const pv = propagate(satrec, date);
  if (!pv || !Number.isFinite(pv.position.x)) return null;
  const ecf = eciToEcf(pv.position, gstime(date));
  return lookAngleFromEcf(frame, ecf);
}

/** Compute satellites currently above `maskDeg` for an observer. */
export function computeVisibleOnServer(
  group: string,
  records: OmmRecord[],
  fetchedAt: string,
  observer: ObserverInput,
  maskDeg: number,
  date: Date,
): ServerVisibleResponse {
  const sats = getCompiledCatalog(group, fetchedAt, records);
  const frame = createObserverFrame(observer);
  const minSin = Math.sin(degreesToRadians(maskDeg - 1.5));
  const gmst = gstime(date);
  const cos = Math.cos(gmst);
  const sin = Math.sin(gmst);
  const scratch = { x: 0, y: 0, z: 0 };
  const visible: ServerVisibleItem[] = [];

  for (const sat of sats) {
    const pv = propagate(sat.satrec, date);
    if (!pv || !Number.isFinite(pv.position.x)) continue;
    const p = pv.position;
    scratch.x = p.x * cos + p.y * sin;
    scratch.y = -p.x * sin + p.y * cos;
    scratch.z = p.z;
    if (approxSinElevation(frame, scratch.x, scratch.y, scratch.z) < minSin) continue;

    const look = lookAngleFromEcf(frame, scratch);
    if (look.elDeg < maskDeg) continue;

    const geo = eciToGeodetic(p, gmst);
    visible.push({
      noradId: sat.noradId,
      name: sat.name,
      intlDesignator: sat.intlDesignator,
      latDeg: degreesLat(geo.latitude),
      lonDeg: degreesLong(geo.longitude),
      altKm: geo.height,
      look,
    });
  }

  visible.sort((a, b) => b.look.elDeg - a.look.elDeg);
  return {
    group,
    timestamp: date.toISOString(),
    maskDeg,
    count: visible.length,
    totalCatalog: sats.length,
    visible,
  };
}

/** Sample sky sectors over `windowMinutes` to recommend unobstructed dish azimuths. */
export function computeCoverageOnServer(
  group: string,
  records: OmmRecord[],
  fetchedAt: string,
  observer: ObserverInput,
  maskDeg: number,
  start: Date,
  windowMinutes: number,
  stepSeconds: number,
  sectorCount: number,
): ServerSkyCoverageResponse {
  const sats = getCompiledCatalog(group, fetchedAt, records);
  const frame = createObserverFrame(observer);
  const minSin = Math.sin(degreesToRadians(maskDeg - 1.5));
  const sectorSize = 360 / sectorCount;
  const windowSectors = Math.min(3, sectorCount);

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

    for (const sat of sats) {
      const pv = propagate(sat.satrec, date);
      if (!pv || !Number.isFinite(pv.position.x)) continue;
      const p = pv.position;
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
  }

  const best = findBestWindow(hits, windowSectors);
  const bestHits = best.reduce((acc, i) => acc + hits[i], 0);
  const bestElSum = best.reduce((acc, i) => acc + elSum[i], 0);

  return {
    sectorCount,
    sectorHits: hits,
    sectorAvgElDeg: hits.map((h, i) => (h ? elSum[i] / h : null)),
    bestAzDeg: weightedCenterAz(best, hits, sectorSize),
    bestSpanDeg: windowSectors * sectorSize,
    bestSectors: best,
    bestAvgElDeg: bestHits ? bestElSum / bestHits : null,
    avgVisibleCount: totalVisible / samples,
    windowMinutes,
    computedAt: new Date().toISOString(),
  };
}

/** Find the current or next pass above `maskDeg` for one NORAD ID. */
export function computeNextPassOnServer(
  group: string,
  records: OmmRecord[],
  fetchedAt: string,
  noradId: number,
  observer: ObserverInput,
  maskDeg: number,
  from: Date,
  horizonHours: number,
): ServerPassResponse | null {
  const sats = getCompiledCatalog(group, fetchedAt, records);
  const sat = sats.find((item) => item.noradId === noradId);
  if (!sat) return null;

  const frame = createObserverFrame(observer);
  const elAt = (ms: number) => lookAngleAt(sat.satrec, frame, new Date(ms))?.elDeg ?? -90;
  const start = from.getTime();
  const end = start + horizonHours * 3_600_000;
  const step = 20_000;

  let aosMs: number | null = null;
  let t = start;

  if (elAt(start) >= maskDeg) {
    let back = start;
    while (elAt(back - step) >= maskDeg && start - back < 3_600_000) back -= step;
    aosMs = refineBoundary(elAt, maskDeg, back - step, back);
  } else {
    let prev = elAt(t);
    while (t < end) {
      const next = t + step;
      const el = elAt(next);
      if (prev < maskDeg && el >= maskDeg) {
        aosMs = refineBoundary(elAt, maskDeg, t, next);
        break;
      }
      prev = el;
      t = next;
    }
  }
  if (aosMs === null) return null;

  let maxEl = -90;
  let maxElMs = aosMs;
  let cursor = Math.max(aosMs, start);
  let losMs: number | null = null;
  while (cursor < end + 3_600_000) {
    const el = elAt(cursor);
    if (el > maxEl) { maxEl = el; maxElMs = cursor; }
    const next = cursor + step;
    if (elAt(next) < maskDeg) {
      losMs = refineBoundary(elAt, maskDeg, next, cursor);
      break;
    }
    cursor = next;
  }
  if (losMs === null) return null;

  for (let s = aosMs; s < Math.max(aosMs, start); s += step) {
    const el = elAt(s);
    if (el > maxEl) { maxEl = el; maxElMs = s; }
  }

  const azAt = (ms: number) => lookAngleAt(sat.satrec, frame, new Date(ms))?.azDeg ?? 0;
  return {
    noradId: sat.noradId,
    name: sat.name,
    aos: new Date(aosMs).toISOString(),
    los: new Date(losMs).toISOString(),
    maxElDeg: maxEl,
    maxElTime: new Date(maxElMs).toISOString(),
    aosAzDeg: azAt(aosMs),
    losAzDeg: azAt(losMs),
  };
}

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

function refineBoundary(elAt: (ms: number) => number, maskDeg: number, belowMs: number, aboveMs: number): number {
  let lo = belowMs;
  let hi = aboveMs;
  while (Math.abs(hi - lo) > 1000) {
    const mid = (lo + hi) / 2;
    if (elAt(mid) >= maskDeg) hi = mid;
    else lo = mid;
  }
  return Math.round(hi);
}
