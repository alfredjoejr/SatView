import type { ServerResponse } from 'node:http';
import { DEFAULT_GROUP, DEFAULT_MASK_DEG } from './config.ts';
import type { ObserverInput } from './types.ts';

/** Explicit HTTP error with status code for clean route error handling. */
export class HttpError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function sendJson(res: ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload);
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(body);
}

export function sendError(res: ServerResponse, status: number, message: string): void {
  sendJson(res, status, { error: message });
}

export interface ParsedOrbitQuery {
  group: string;
  observer: ObserverInput;
  maskDeg: number;
  date: Date;
}

export function parseOrbitQuery(params: URLSearchParams): ParsedOrbitQuery {
  const group = (params.get('group') ?? DEFAULT_GROUP).trim().toLowerCase();
  if (!/^[a-z0-9_-]{1,40}$/.test(group)) {
    throw new HttpError(400, 'Invalid constellation group parameter');
  }

  const latRaw = params.get('lat');
  const lonRaw = params.get('lon');
  if (latRaw === null || lonRaw === null) {
    throw new HttpError(400, 'Missing required lat and lon query parameters');
  }

  const latDeg = Number(latRaw);
  const lonDeg = Number(lonRaw);
  if (!Number.isFinite(latDeg) || Math.abs(latDeg) > 90 || !Number.isFinite(lonDeg) || Math.abs(lonDeg) > 180) {
    throw new HttpError(400, 'lat must be within [-90, 90] and lon within [-180, 180]');
  }

  const altM = params.has('altM') ? Number(params.get('altM')) : 0;
  if (!Number.isFinite(altM)) {
    throw new HttpError(400, 'Invalid altM parameter');
  }

  const maskDeg = params.has('maskDeg') ? Number(params.get('maskDeg')) : DEFAULT_MASK_DEG;
  if (!Number.isFinite(maskDeg) || maskDeg < 0 || maskDeg > 89) {
    throw new HttpError(400, 'maskDeg must be between 0 and 89');
  }

  const date = parseIsoDate(params.get('time'));
  return {
    group,
    observer: { latDeg, lonDeg, altM },
    maskDeg,
    date,
  };
}

export function parseIsoDate(raw: string | null): Date {
  if (!raw) return new Date();
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    throw new HttpError(400, 'Invalid time parameter (expected ISO 8601 timestamp)');
  }
  return parsed;
}
