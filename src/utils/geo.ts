export const EARTH_RADIUS_KM = 6371;

/**
 * Ground radius (km) around an observer within which a satellite at `altKm`
 * appears above `maskDeg` elevation. Used to draw the coverage footprint.
 */
export function coverageRadiusKm(maskDeg: number, altKm: number): number {
  const eps = (maskDeg * Math.PI) / 180;
  const centralAngle = Math.acos((EARTH_RADIUS_KM * Math.cos(eps)) / (EARTH_RADIUS_KM + altKm)) - eps;
  return EARTH_RADIUS_KM * centralAngle;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
