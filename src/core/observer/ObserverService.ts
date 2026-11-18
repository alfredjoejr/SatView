import {
  DEFAULT_ELEVATION_MASK_DEG,
  MAX_ELEVATION_MASK_DEG,
  MIN_ELEVATION_MASK_DEG,
  STORAGE_KEYS,
} from '../../config/constants';
import type { AppStore } from '../state/AppStore';
import type { ObserverLocation } from '../types';

const GEO_TIMEOUT_MS = 15_000;

/**
 * Handles where the user is: browser geolocation, manual entry and
 * persistence in localStorage.
 */
export class ObserverService {
  constructor(private readonly store: AppStore) {
    store.bus.on('observer:changed', ({ observer }) => this.persist(STORAGE_KEYS.observer, observer));
    store.bus.on('mask:changed', ({ maskDeg }) => this.persist(STORAGE_KEYS.elevationMask, maskDeg));
  }

  /** Restore saved settings; auto-locate only if permission was already granted. */
  restore(): void {
    const mask = this.read<number>(STORAGE_KEYS.elevationMask);
    if (typeof mask === 'number' && mask >= MIN_ELEVATION_MASK_DEG && mask <= MAX_ELEVATION_MASK_DEG) {
      this.store.setElevationMask(mask);
    } else {
      this.store.setElevationMask(DEFAULT_ELEVATION_MASK_DEG);
    }

    const saved = this.read<ObserverLocation>(STORAGE_KEYS.observer);
    if (saved && isValidLatLon(saved.latDeg, saved.lonDeg)) {
      this.store.setObserver(saved);
    }
    if (!saved || saved.source === 'gps') void this.tryAutoLocate();
  }

  /** Ask the browser for the current position. Requires HTTPS or localhost. */
  locate(): Promise<ObserverLocation> {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({
            latDeg: pos.coords.latitude,
            lonDeg: pos.coords.longitude,
            altM: pos.coords.altitude ?? 0,
            accuracyM: pos.coords.accuracy,
            label: 'My location',
            source: 'gps',
          }),
        (err) => reject(new Error(describeGeoError(err))),
        { enableHighAccuracy: true, timeout: GEO_TIMEOUT_MS, maximumAge: 60_000 },
      );
    });
  }

  createManual(latDeg: number, lonDeg: number, label = 'Custom location'): ObserverLocation {
    if (!isValidLatLon(latDeg, lonDeg)) {
      throw new Error('Latitude must be between -90 and 90, longitude between -180 and 180.');
    }
    return { latDeg, lonDeg, altM: 0, label, source: 'manual' };
  }

  private async tryAutoLocate(): Promise<void> {
    try {
      if (!navigator.permissions) return;
      const status = await navigator.permissions.query({ name: 'geolocation' });
      if (status.state !== 'granted') return;
      this.store.setObserver(await this.locate());
    } catch {
      // Silent: user can still locate manually.
    }
  }

  private persist(key: string, value: unknown): void {
    try {
      if (value === null || value === undefined) localStorage.removeItem(key);
      else localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be disabled */
    }
  }

  private read<T>(key: string): T | null {
    try {
      const raw = localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  }
}

export function isValidLatLon(lat: number, lon: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}

function describeGeoError(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Location permission denied. Enable it in your browser, or enter coordinates manually.';
    case err.POSITION_UNAVAILABLE:
      return 'Your position could not be determined.';
    case err.TIMEOUT:
      return 'Timed out while getting your location.';
    default:
      return err.message || 'Unknown geolocation error.';
  }
}
