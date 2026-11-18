import type { SatRec } from 'satellite.js';
import type { SatellitePass } from '../types';
import { lookAngleAt, type ObserverFrame } from './lookAngles';

const COARSE_STEP_S = 20;
const REFINE_TOLERANCE_MS = 1000;

/**
 * Find the current or next pass of a satellite above `maskDeg`.
 * If the satellite is already above the mask, `aos` is in the past.
 */
export function predictNextPass(
  satrec: SatRec,
  frame: ObserverFrame,
  maskDeg: number,
  from: Date,
  horizonHours: number,
): SatellitePass | null {
  const elAt = (ms: number) => lookAngleAt(satrec, frame, new Date(ms))?.elDeg ?? -90;
  const start = from.getTime();
  const end = start + horizonHours * 3_600_000;
  const step = COARSE_STEP_S * 1000;

  let aosMs: number | null = null;
  let t = start;

  if (elAt(start) >= maskDeg) {
    // Already up: walk backwards to find when it rose.
    let back = start;
    while (elAt(back - step) >= maskDeg && start - back < 3_600_000) back -= step;
    aosMs = refine(elAt, maskDeg, back - step, back);
  } else {
    let prev = elAt(t);
    while (t < end) {
      const next = t + step;
      const el = elAt(next);
      if (prev < maskDeg && el >= maskDeg) {
        aosMs = refine(elAt, maskDeg, t, next);
        t = next;
        break;
      }
      prev = el;
      t = next;
    }
  }
  if (aosMs === null) return null;

  // Walk forward to LOS, tracking max elevation.
  let maxEl = -90;
  let maxElMs = aosMs;
  let cursor = Math.max(aosMs, start);
  let losMs: number | null = null;
  while (cursor < end + 3_600_000) {
    const el = elAt(cursor);
    if (el > maxEl) { maxEl = el; maxElMs = cursor; }
    const next = cursor + step;
    if (elAt(next) < maskDeg) {
      losMs = refine(elAt, maskDeg, next, cursor);
      break;
    }
    cursor = next;
  }
  if (losMs === null) return null;

  // Include elevation before `start` for passes already in progress.
  for (let s = aosMs; s < Math.max(aosMs, start); s += step) {
    const el = elAt(s);
    if (el > maxEl) { maxEl = el; maxElMs = s; }
  }

  const azAt = (ms: number) => lookAngleAt(satrec, frame, new Date(ms))?.azDeg ?? 0;
  return {
    aos: new Date(aosMs),
    los: new Date(losMs),
    maxElDeg: maxEl,
    maxElTime: new Date(maxElMs),
    aosAzDeg: azAt(aosMs),
    losAzDeg: azAt(losMs),
  };
}

/**
 * Bisection between a time below the mask (`belowMs`) and one above (`aboveMs`).
 * Works in either time direction.
 */
function refine(elAt: (ms: number) => number, maskDeg: number, belowMs: number, aboveMs: number): number {
  let lo = belowMs;
  let hi = aboveMs;
  while (Math.abs(hi - lo) > REFINE_TOLERANCE_MS) {
    const mid = (lo + hi) / 2;
    if (elAt(mid) >= maskDeg) hi = mid;
    else lo = mid;
  }
  return Math.round(hi);
}
