/** App-wide tunables. Keep magic numbers here, not scattered in modules. */

export const APP_NAME = 'SatView';

/** How often (real time) satellite positions are re-propagated. */
export const SIM_STEP_INTERVAL_MS = 250;

/** How often (real time) the "satellites above me" list is recomputed. */
export const VISIBILITY_INTERVAL_MS = 1000;

/** A sim-time jump larger than this (e.g. timeline scrub) forces an immediate refresh. */
export const SIM_JUMP_THRESHOLD_MS = 30_000;

/** Starlink terminals generally only use satellites above ~25° elevation. */
export const DEFAULT_ELEVATION_MASK_DEG = 25;
export const MIN_ELEVATION_MASK_DEG = 0;
export const MAX_ELEVATION_MASK_DEG = 70;

/** CelesTrak asks clients not to re-download the same group more than every ~2h. */
export const CATALOG_CACHE_TTL_MS = 2 * 60 * 60 * 1000;

/** Max number of observer→satellite link lines drawn on the globe. */
export const MAX_LINK_LINES = 40;

/** Max rows rendered in the "overhead now" list. */
export const VISIBLE_LIST_LIMIT = 60;

/** Dish guide analysis window. */
export const COVERAGE_WINDOW_MINUTES = 30;
export const COVERAGE_STEP_SECONDS = 60;
export const COVERAGE_SECTOR_COUNT = 12;

/** Pass prediction search horizon for the selected satellite. */
export const PASS_SEARCH_HOURS = 24;

export const STORAGE_KEYS = {
  observer: 'satview.observer',
  elevationMask: 'satview.elevationMask',
} as const;

/** In dev we go through the Vite proxy; in production we call CelesTrak directly (CORS-enabled). */
export const CELESTRAK_BASE_URL = import.meta.env.DEV ? '/api/celestrak' : 'https://celestrak.org';

export const COLORS = {
  satellite: '#8fb8de',
  visible: '#3ddc97',
  selected: '#ffd166',
  observer: '#4cc9f0',
  link: '#3ddc97',
  orbit: '#ffd166',
  coverage: '#4cc9f0',
} as const;
