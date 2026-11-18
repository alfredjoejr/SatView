import {
  degreesToRadians,
  ecfToLookAngles,
  geodeticToEcf,
  radiansToDegrees,
  type EcfVec3,
  type GeodeticLocation,
  type SatRec,
} from 'satellite.js';
import type { LookAngle, ObserverLocation } from '../types';
import { propagateState } from './propagator';

/**
 * Pre-computed observer geometry, reused across many look-angle calculations.
 * `up` is the geocentric unit vector (good enough for cheap pre-filtering).
 */
export interface ObserverFrame {
  geodetic: GeodeticLocation;
  ecf: EcfVec3<number>;
  up: EcfVec3<number>;
}

export function createObserverFrame(observer: ObserverLocation): ObserverFrame {
  const geodetic: GeodeticLocation = {
    latitude: degreesToRadians(observer.latDeg),
    longitude: degreesToRadians(observer.lonDeg),
    height: observer.altM / 1000,
  };
  const ecf = geodeticToEcf(geodetic);
  const len = Math.hypot(ecf.x, ecf.y, ecf.z);
  return { geodetic, ecf, up: { x: ecf.x / len, y: ecf.y / len, z: ecf.z / len } };
}

/** Approximate sine of elevation (geocentric). Fast pre-filter before exact math. */
export function approxSinElevation(frame: ObserverFrame, x: number, y: number, z: number): number {
  const dx = x - frame.ecf.x;
  const dy = y - frame.ecf.y;
  const dz = z - frame.ecf.z;
  const range = Math.hypot(dx, dy, dz);
  return (dx * frame.up.x + dy * frame.up.y + dz * frame.up.z) / range;
}

export function lookAngleFromEcf(frame: ObserverFrame, satEcf: EcfVec3<number>): LookAngle {
  const look = ecfToLookAngles(frame.geodetic, satEcf);
  return {
    azDeg: (radiansToDegrees(look.azimuth) + 360) % 360,
    elDeg: radiansToDegrees(look.elevation),
    rangeKm: look.rangeSat,
  };
}

export function lookAngleAt(satrec: SatRec, frame: ObserverFrame, date: Date): LookAngle | null {
  const state = propagateState(satrec, date);
  return state ? lookAngleFromEcf(frame, state.ecf) : null;
}
