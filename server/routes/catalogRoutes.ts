import type { ServerResponse } from 'node:http';
import { CONSTELLATIONS } from '../../src/config/constellations.ts';
import { sendJson } from '../httpUtils.ts';
import { getCatalog } from '../services/catalogCacheService.ts';

/**
 * Handles `/api/health`, `/api/constellations`, and `/api/catalog/:group`.
 * Returns `true` when the request path matched a catalog route.
 */
export async function handleCatalogRoutes(
  pathname: string,
  searchParams: URLSearchParams,
  res: ServerResponse,
): Promise<boolean> {
  if (pathname === '/api/health') {
    sendJson(res, 200, {
      status: 'ok',
      uptimeSec: Math.round(process.uptime()),
      timestamp: new Date().toISOString(),
    });
    return true;
  }

  if (pathname === '/api/constellations') {
    sendJson(res, 200, { constellations: CONSTELLATIONS });
    return true;
  }

  const catalogMatch = /^\/api\/catalog\/([^/]+)$/.exec(pathname);
  if (catalogMatch) {
    const group = decodeURIComponent(catalogMatch[1]);
    const forceRefresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true';
    const payload = await getCatalog(group, forceRefresh);
    sendJson(res, 200, payload);
    return true;
  }

  return false;
}
