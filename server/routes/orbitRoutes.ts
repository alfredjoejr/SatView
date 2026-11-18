import type { ServerResponse } from 'node:http';
import {
  DEFAULT_COVERAGE_STEP_SECONDS,
  DEFAULT_COVERAGE_WINDOW_MINUTES,
  DEFAULT_PASS_HORIZON_HOURS,
  DEFAULT_SECTOR_COUNT,
} from '../config.ts';
import { HttpError, parseOrbitQuery, sendJson } from '../httpUtils.ts';
import { getCatalog } from '../services/catalogCacheService.ts';
import {
  computeCoverageOnServer,
  computeNextPassOnServer,
  computeVisibleOnServer,
} from '../services/orbitComputeService.ts';

/**
 * Handles `/api/observer/visible`, `/api/observer/coverage`, and `/api/satellites/:noradId/pass`.
 * Returns `true` when the request path matched an orbit route.
 */
export async function handleOrbitRoutes(
  pathname: string,
  searchParams: URLSearchParams,
  res: ServerResponse,
): Promise<boolean> {
  if (pathname === '/api/observer/visible') {
    const query = parseOrbitQuery(searchParams);
    const catalog = await getCatalog(query.group);
    const result = computeVisibleOnServer(
      catalog.group,
      catalog.records,
      catalog.fetchedAt,
      query.observer,
      query.maskDeg,
      query.date,
    );
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === '/api/observer/coverage') {
    const query = parseOrbitQuery(searchParams);
    const windowRaw = searchParams.get('windowMinutes');
    const windowMinutes = windowRaw !== null ? Number(windowRaw) : DEFAULT_COVERAGE_WINDOW_MINUTES;
    if (!Number.isFinite(windowMinutes) || windowMinutes < 1 || windowMinutes > 180) {
      throw new HttpError(400, 'windowMinutes must be between 1 and 180');
    }

    const stepRaw = searchParams.get('stepSeconds');
    const stepSeconds = stepRaw !== null ? Number(stepRaw) : DEFAULT_COVERAGE_STEP_SECONDS;
    if (!Number.isFinite(stepSeconds) || stepSeconds < 10 || stepSeconds > 300) {
      throw new HttpError(400, 'stepSeconds must be between 10 and 300');
    }

    const sectorRaw = searchParams.get('sectorCount');
    const sectorCount = sectorRaw !== null ? Math.round(Number(sectorRaw)) : DEFAULT_SECTOR_COUNT;
    if (!Number.isFinite(sectorCount) || sectorCount < 4 || sectorCount > 36) {
      throw new HttpError(400, 'sectorCount must be between 4 and 36');
    }

    const catalog = await getCatalog(query.group);
    const coverage = computeCoverageOnServer(
      catalog.group,
      catalog.records,
      catalog.fetchedAt,
      query.observer,
      query.maskDeg,
      query.date,
      windowMinutes,
      stepSeconds,
      sectorCount,
    );
    sendJson(res, 200, coverage);
    return true;
  }

  const passMatch = /^\/api\/satellites\/(\d+)\/pass$/.exec(pathname);
  if (passMatch) {
    const noradId = Number(passMatch[1]);
    if (!Number.isInteger(noradId) || noradId <= 0) {
      throw new HttpError(400, 'Invalid NORAD ID');
    }

    const query = parseOrbitQuery(searchParams);
    const horizonRaw = searchParams.get('horizonHours');
    const horizonHours = horizonRaw !== null ? Number(horizonRaw) : DEFAULT_PASS_HORIZON_HOURS;
    if (!Number.isFinite(horizonHours) || horizonHours < 1 || horizonHours > 72) {
      throw new HttpError(400, 'horizonHours must be between 1 and 72');
    }

    const catalog = await getCatalog(query.group);
    const pass = computeNextPassOnServer(
      catalog.group,
      catalog.records,
      catalog.fetchedAt,
      noradId,
      query.observer,
      query.maskDeg,
      query.date,
      horizonHours,
    );
    sendJson(res, 200, { pass });
    return true;
  }

  return false;
}
