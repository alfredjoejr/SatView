import { defineConfig, type Plugin } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { handleApiRequest } from './server/app.ts';

/**
 * Cesium ships static assets (web workers, textures, widget CSS) that must be
 * served next to the app. We copy them into `<base>/cesium/` and tell Cesium
 * where to find them via the CESIUM_BASE_URL global.
 */
const CESIUM_SOURCE = 'node_modules/cesium/Build/Cesium';
const CESIUM_DIR = 'cesium';

function satViewBackendPlugin(): Plugin {
  const attachMiddleware = (middlewares: {
    use: (
      fn: (
        req: import('node:http').IncomingMessage,
        res: import('node:http').ServerResponse,
        next: (err?: unknown) => void,
      ) => void,
    ) => void;
  }) => {
    middlewares.use((req, res, next) => {
      void handleApiRequest(req, res)
        .then((handled) => {
          if (!handled) next();
        })
        .catch(next);
    });
  };

  return {
    name: 'satview-backend',
    configureServer(server) {
      attachMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachMiddleware(server.middlewares);
    },
  };
}

export default defineConfig(() => {
  // Set SATVIEW_BASE=/SatView/ when deploying to a sub-path (e.g. GitHub Pages).
  const base = process.env.SATVIEW_BASE ?? '/';
  const backendUrl = process.env.SATVIEW_BACKEND_URL;
  const proxy = backendUrl ? { '/api': { target: backendUrl, changeOrigin: true } } : undefined;

  return {
    base,
    define: {
      CESIUM_BASE_URL: JSON.stringify(`${base}${CESIUM_DIR}/`),
    },
    plugins: [
      ...(backendUrl ? [] : [satViewBackendPlugin()]),
      viteStaticCopy({
        targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((folder) => ({
          src: `${CESIUM_SOURCE}/${folder}`,
          dest: CESIUM_DIR,
          rename: { stripBase: 4 },
        })),
      }),
    ],
    server: proxy ? { proxy } : undefined,
    preview: proxy ? { proxy } : undefined,
    worker: {
      format: 'es',
    },
    build: {
      chunkSizeWarningLimit: 6000,
    },
  };
});
