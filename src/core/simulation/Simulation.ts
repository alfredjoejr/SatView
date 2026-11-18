import { gstime, propagate } from 'satellite.js';
import type { AppStore } from '../state/AppStore';
import type { GeoPosition } from '../types';
import { eciToGeoPosition } from '../orbit/propagator';

/**
 * Propagates every satellite in the catalog to a given instant and keeps the
 * results in flat typed arrays (km), so the globe and visibility code can read
 * them without allocating per frame.
 */
export class Simulation {
  /** Earth-centered inertial (TEME) positions, km, [x0,y0,z0,x1,...]. */
  eci = new Float64Array(0);
  /** Earth-centered Earth-fixed positions, km. */
  ecf = new Float64Array(0);
  /** 1 when the satellite propagated successfully at `date`. */
  valid = new Uint8Array(0);
  date = new Date(0);
  gmst = 0;

  constructor(private readonly store: AppStore) {}

  get ready(): boolean {
    return this.valid.length > 0 && this.valid.length === this.store.records.length;
  }

  step(date: Date): void {
    const records = this.store.records;
    const n = records.length;
    if (this.valid.length !== n) {
      this.eci = new Float64Array(n * 3);
      this.ecf = new Float64Array(n * 3);
      this.valid = new Uint8Array(n);
    }

    const gmst = gstime(date);
    const cos = Math.cos(gmst);
    const sin = Math.sin(gmst);
    this.date = date;
    this.gmst = gmst;

    for (let i = 0; i < n; i++) {
      const pv = propagate(records[i].satrec, date);
      if (!pv || !Number.isFinite(pv.position.x)) {
        this.valid[i] = 0;
        continue;
      }
      const { x, y, z } = pv.position;
      const o = i * 3;
      this.eci[o] = x;
      this.eci[o + 1] = y;
      this.eci[o + 2] = z;
      // ECI → ECF: rotate about Z by GMST.
      this.ecf[o] = x * cos + y * sin;
      this.ecf[o + 1] = -x * sin + y * cos;
      this.ecf[o + 2] = z;
      this.valid[i] = 1;
    }
  }

  isValid(index: number): boolean {
    return this.valid[index] === 1;
  }

  /** ECF position in km, or null if unavailable. */
  getEcfKm(index: number): { x: number; y: number; z: number } | null {
    if (!this.isValid(index)) return null;
    const o = index * 3;
    return { x: this.ecf[o], y: this.ecf[o + 1], z: this.ecf[o + 2] };
  }

  getGeodetic(index: number): GeoPosition | null {
    if (!this.isValid(index)) return null;
    const o = index * 3;
    return eciToGeoPosition({ x: this.eci[o], y: this.eci[o + 1], z: this.eci[o + 2] }, this.gmst);
  }
}
