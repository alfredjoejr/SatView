import type { IncomingMessage, ServerResponse } from 'node:http';
import { CELESTRAK_ORIGIN, REQUEST_TIMEOUT_MS } from './config.ts';
import { HttpError, sendError } from './httpUtils.ts';
import { handleCatalogRoutes } from './routes/catalogRoutes.ts';
import { handleOrbitRoutes } from './routes/orbitRoutes.ts';

function setCorsHeaders(res: ServerResponse): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

async function handleCelestrakCompatProxy(
  pathname: string,
  search: string,
  res: ServerResponse,
): Promise<boolean> {
  if (!pathname.startsWith('/api/celestrak/')) return false;
  const upstreamPath = pathname.slice('/api/celestrak'.length);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(`${CELESTRAK_ORIGIN}${upstreamPath}${search}`, {
      signal: controller.signal,
    });
    const text = await response.text();
    res.statusCode = response.status;
    res.setHeader('Content-Type', response.headers.get('content-type') ?? 'application/json; charset=utf-8');
    res.end(text);
  } finally {
    clearTimeout(timer);
  }
  return true;
}

/**
 * Shared API dispatcher used by both the standalone Node server (`server/index.ts`)
 * and the Vite development middleware (`vite.config.ts`).
 * Returns `true` if the request targeted `/api/*` and was handled.
 */
export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const rawUrl = req.url ?? '/';
  const parsed = new URL(rawUrl, 'http://localhost');
  const { pathname, searchParams, search } = parsed;

  if (!pathname.startsWith('/api/') && pathname !== '/api') {
    return false;
  }

  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return true;
  }

  if (req.method !== 'GET') {
    sendError(res, 405, `Method ${req.method ?? 'UNKNOWN'} not allowed`);
    return true;
  }

  try {
    if (await handleCatalogRoutes(pathname, searchParams, res)) return true;
    if (await handleOrbitRoutes(pathname, searchParams, res)) return true;
    if (await handleCelestrakCompatProxy(pathname, search, res)) return true;

    sendError(res, 404, `Unknown API endpoint: ${pathname}`);
    return true;
  } catch (err) {
    if (err instanceof HttpError) {
      sendError(res, err.status, err.message);
      return true;
    }
    console.error(`[SatView API] ${pathname} failed:`, err);
    sendError(res, 500, err instanceof Error ? err.message : 'Internal server error');
    return true;
  }
}
