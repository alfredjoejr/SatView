import { degreesToRadians } from 'satellite.js';
import type { Simulation } from '../simulation/Simulation';
import type { ObserverLocation, VisibleSatellite } from '../types';
import { approxSinElevation, createObserverFrame, lookAngleFromEcf } from './lookAngles';

/** Margin applied to the cheap geocentric pre-filter so no satellite is missed. */
const PREFILTER_MARGIN_DEG = 1.5;

/**
 * All satellites currently above `maskDeg` for the observer, highest first.
 * Uses the latest positions from the simulation (no extra propagation).
 */
export function computeVisible(sim: Simulation, observer: ObserverLocation, maskDeg: number): VisibleSatellite[] {
  const frame = createObserverFrame(observer);
  const minSin = Math.sin(degreesToRadians(maskDeg - PREFILTER_MARGIN_DEG));
  const { ecf, valid } = sim;
  const result: VisibleSatellite[] = [];
  const scratch = { x: 0, y: 0, z: 0 };

  for (let i = 0; i < valid.length; i++) {
    if (!valid[i]) continue;
    const o = i * 3;
    const x = ecf[o], y = ecf[o + 1], z = ecf[o + 2];
    if (approxSinElevation(frame, x, y, z) < minSin) continue;

    scratch.x = x; scratch.y = y; scratch.z = z;
    const look = lookAngleFromEcf(frame, scratch);
    if (look.elDeg >= maskDeg) result.push({ index: i, look });
  }

  result.sort((a, b) => b.look.elDeg - a.look.elDeg);
  return result;
}
