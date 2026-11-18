import { createServer, type ServerResponse } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { handleApiRequest } from './app.ts';
import { DIST_DIR, PORT } from './config.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.xml': 'application/xml; charset=utf-8',
  '.wasm': 'application/wasm',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
};

async function serveStatic(urlPath: string, res: ServerResponse): Promise<void> {
  const cleanPath = decodeURIComponent(urlPath.split('?')[0]);
  const relative = cleanPath === '/' ? 'index.html' : cleanPath.replace(/^\/+/, '');
  let target = path.resolve(DIST_DIR, relative);

  if (target !== DIST_DIR && !target.startsWith(`${DIST_DIR}${path.sep}`)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  try {
    const info = await stat(target);
    if (info.isDirectory()) target = path.join(target, 'index.html');
    const data = await readFile(target);
    const ext = path.extname(target).toLowerCase();
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
    res.end(data);
    return;
  } catch {
    // Only fall back to index.html for extensionless SPA routes, never for missing assets/tiles.
    if (path.extname(relative)) {
      res.statusCode = 404;
      res.end('Not found');
      return;
    }
  }

  try {
    const indexHtml = await readFile(path.join(DIST_DIR, 'index.html'));
    res.statusCode = 200;
    res.setHeader('Content-Type', MIME_TYPES['.html']);
    res.end(indexHtml);
  } catch {
    res.statusCode = 404;
    res.end('Production build not found. Run "npm run build" first.');
  }
}

const server = createServer(async (req, res) => {
  const handled = await handleApiRequest(req, res);
  if (handled) return;
  await serveStatic(req.url ?? '/', res);
});

server.listen(PORT, () => {
  console.log(`SatView backend listening on http://localhost:${PORT}`);
});
