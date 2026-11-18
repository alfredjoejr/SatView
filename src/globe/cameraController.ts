import { Cartesian3, type Viewer } from 'cesium';
import type { GeoPosition, ObserverLocation } from '../core/types';

const FLY_DURATION_S = 1.6;

export function flyToObserver(viewer: Viewer, observer: ObserverLocation, heightM = 3_500_000): void {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(observer.lonDeg, observer.latDeg, heightM),
    duration: FLY_DURATION_S,
  });
}

export function flyToGeo(viewer: Viewer, geo: GeoPosition, extraHeightM = 2_500_000): void {
  viewer.camera.flyTo({
    destination: Cartesian3.fromDegrees(geo.lonDeg, geo.latDeg, geo.altKm * 1000 + extraHeightM),
    duration: FLY_DURATION_S,
  });
}
