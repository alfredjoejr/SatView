/**
 * Constellation registry.
 *
 * Adding a new constellation later is just a new entry here: the catalog
 * service, simulation, globe layers and UI are all constellation-agnostic.
 * Flip `available` to true once it has been tested.
 */
export interface ConstellationConfig {
  /** Stable id used for caching and state. */
  id: string;
  /** Display name. */
  name: string;
  /** CelesTrak GP "GROUP" query value. */
  celestrakGroup: string;
  /** Point color on the globe (CSS color). */
  color: string;
  /** Whether it can be selected in the UI yet. */
  available: boolean;
  /** Representative operating altitude, used for the coverage footprint. */
  shellAltitudeKm: number;
  /** Typical minimum usable elevation for user terminals. */
  defaultMaskDeg: number;
  description: string;
}

export const CONSTELLATIONS: readonly ConstellationConfig[] = [
  {
    id: 'starlink',
    name: 'Starlink',
    celestrakGroup: 'starlink',
    color: '#8fb8de',
    available: true,
    shellAltitudeKm: 550,
    defaultMaskDeg: 25,
    description: 'SpaceX low-Earth-orbit broadband constellation.',
  },
  {
    id: 'oneweb',
    name: 'OneWeb',
    celestrakGroup: 'oneweb',
    color: '#c77dff',
    available: false,
    shellAltitudeKm: 1200,
    defaultMaskDeg: 30,
    description: 'Eutelsat OneWeb LEO broadband constellation.',
  },
  {
    id: 'kuiper',
    name: 'Amazon Leo',
    celestrakGroup: 'kuiper',
    color: '#ff9f1c',
    available: false,
    shellAltitudeKm: 630,
    defaultMaskDeg: 35,
    description: 'Amazon Leo (Project Kuiper) LEO broadband constellation.',
  },
  {
    id: 'gps',
    name: 'GPS',
    celestrakGroup: 'gps-ops',
    color: '#90e0ef',
    available: false,
    shellAltitudeKm: 20200,
    defaultMaskDeg: 10,
    description: 'US Global Positioning System (MEO).',
  },
];

export const DEFAULT_CONSTELLATION_ID = 'starlink';

export function getConstellation(id: string): ConstellationConfig {
  const found = CONSTELLATIONS.find((c) => c.id === id);
  if (!found) throw new Error(`Unknown constellation "${id}"`);
  return found;
}
