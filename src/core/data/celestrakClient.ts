import { CELESTRAK_BASE_URL } from '../../config/constants';

/**
 * Orbit Mean-elements Message (OMM) record as returned by CelesTrak's
 * GP API in JSON format. OMM is used instead of legacy TLE text because it
 * supports 6+ digit catalog numbers.
 */
export interface OmmRecord {
  OBJECT_NAME: string;
  OBJECT_ID: string;
  EPOCH: string;
  MEAN_MOTION: number;
  ECCENTRICITY: number;
  INCLINATION: number;
  RA_OF_ASC_NODE: number;
  ARG_OF_PERICENTER: number;
  MEAN_ANOMALY: number;
  EPHEMERIS_TYPE: number;
  CLASSIFICATION_TYPE: string;
  NORAD_CAT_ID: number;
  ELEMENT_SET_NO: number;
  REV_AT_EPOCH: number;
  BSTAR: number;
  MEAN_MOTION_DOT: number;
  MEAN_MOTION_DDOT: number;
}

const REQUEST_TIMEOUT_MS = 30_000;

/** Download the current element sets for a CelesTrak group, e.g. "starlink". */
export async function fetchGroupOmm(group: string): Promise<OmmRecord[]> {
  const url = `${CELESTRAK_BASE_URL}/NORAD/elements/gp.php?GROUP=${encodeURIComponent(group)}&FORMAT=json`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, { signal: controller.signal });
    const body = await response.text();
    if (!response.ok) {
      throw new Error(`CelesTrak responded ${response.status}: ${body.slice(0, 120)}`);
    }
    let data: unknown;
    try {
      data = JSON.parse(body);
    } catch {
      // CelesTrak returns plain text for errors / rate limits.
      throw new Error(`CelesTrak: ${body.slice(0, 160) || 'empty response'}`);
    }
    if (!Array.isArray(data)) throw new Error('CelesTrak returned an unexpected payload');
    return data.filter(isOmmRecord);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error('Timed out downloading satellite data from CelesTrak');
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

function isOmmRecord(value: unknown): value is OmmRecord {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<OmmRecord>;
  return typeof v.OBJECT_NAME === 'string' && typeof v.MEAN_MOTION === 'number' && typeof v.EPOCH === 'string';
}
