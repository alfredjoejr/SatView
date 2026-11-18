import {
  degreesLat,
  degreesLong,
  eciToEcf,
  eciToGeodetic,
  gstime,
  propagate,
  type EcfVec3,
  type EciVec3,
  type SatRec,
} from 'satellite.js';
import type { GeoPosition } from '../types';

export interface PropagatedState {
  eci: EciVec3<number>;
  ecf: EcfVec3<number>;
  velocityEci: EciVec3<number>;
  gmst: number;
}

/** Propagate one satellite to `date`. Positions are in km. */
export function propagateState(satrec: SatRec, date: Date): PropagatedState | null {
  const pv = propagate(satrec, date);
  if (!pv || !Number.isFinite(pv.position.x)) return null;
  const gmst = gstime(date);
  return {
    eci: pv.position,
    ecf: eciToEcf(pv.position, gmst),
    velocityEci: pv.velocity,
    gmst,
  };
}

export function eciToGeoPosition(eci: EciVec3<number>, gmst: number): GeoPosition {
  const g = eciToGeodetic(eci, gmst);
  return {
    latDeg: degreesLat(g.latitude),
    lonDeg: degreesLong(g.longitude),
    altKm: g.height,
  };
}

export function vectorLength(v: { x: number; y: number; z: number }): number {
  return Math.hypot(v.x, v.y, v.z);
}
