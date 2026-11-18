const COMPASS_16 = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

export function compassPoint(azDeg: number): string {
  return COMPASS_16[Math.round((((azDeg % 360) + 360) % 360) / 22.5) % 16];
}

export function formatDeg(value: number, digits = 1): string {
  return Number.isFinite(value) ? `${value.toFixed(digits)}°` : '—';
}

export function formatAzimuth(azDeg: number): string {
  return `${azDeg.toFixed(0)}° ${compassPoint(azDeg)}`;
}

export function formatKm(km: number, digits = 0): string {
  return `${km.toLocaleString(undefined, { maximumFractionDigits: digits })} km`;
}

export function formatLatLon(latDeg: number, lonDeg: number): string {
  const lat = `${Math.abs(latDeg).toFixed(4)}° ${latDeg >= 0 ? 'N' : 'S'}`;
  const lon = `${Math.abs(lonDeg).toFixed(4)}° ${lonDeg >= 0 ? 'E' : 'W'}`;
  return `${lat}, ${lon}`;
}

export function formatClock(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleString(undefined, {
    year: 'numeric', month: 'short', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

/** "4m 05s", "1h 12m" */
export function formatDuration(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m`;
  return `${m}m ${String(s).padStart(2, '0')}s`;
}

export function timeAgo(date: Date, now = new Date()): string {
  const sec = Math.round((now.getTime() - date.getTime()) / 1000);
  if (sec < 60) return 'just now';
  const min = Math.round(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr} h ago`;
  return `${Math.round(hr / 24)} days ago`;
}

export function formatCount(n: number): string {
  return n.toLocaleString();
}
