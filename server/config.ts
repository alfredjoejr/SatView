import path from 'node:path';

/** Backend configuration constants. */
export const PORT = Number(process.env.PORT ?? 3001);
export const CACHE_DIR = path.resolve(process.cwd(), '.cache');
export const DIST_DIR = path.resolve(process.cwd(), 'dist');

export const CELESTRAK_ORIGIN = 'https://celestrak.org';
export const CATALOG_TTL_MS = 2 * 60 * 60 * 1000;
export const REQUEST_TIMEOUT_MS = 30_000;
export const MAX_EPOCH_AGE_DAYS = 45;

export const DEFAULT_GROUP = 'starlink';
export const DEFAULT_MASK_DEG = 25;
export const DEFAULT_SECTOR_COUNT = 12;
export const DEFAULT_COVERAGE_WINDOW_MINUTES = 30;
export const DEFAULT_COVERAGE_STEP_SECONDS = 60;
export const DEFAULT_PASS_HORIZON_HOURS = 24;
