import { defineConfig } from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';

/**
 * Cesium ships static assets (web workers, textures, widget CSS) that must be
 * served next to the app. We copy them into `<base>/cesium/` and tell Cesium
 * where to find them via the CESIUM_BASE_URL global.
 */
const CESIUM_SOURCE = 'node_modules/cesium/Build/Cesium';
const CESIUM_DIR = 'cesium';

export default defineConfig(() => {
  // Set SATVIEW_BASE=/SatView/ when deploying to a sub-path (e.g. GitHub Pages).
  const base = process.env.SATVIEW_BASE ?? '/';

  return {
    base,
    define: {
      CESIUM_BASE_URL: JSON.stringify(`${base}${CESIUM_DIR}/`),
    },
    plugins: [
      viteStaticCopy({
        targets: ['ThirdParty', 'Workers', 'Assets', 'Widgets'].map((folder) => ({
          src: `${CESIUM_SOURCE}/${folder}`,
          dest: CESIUM_DIR,
        })),
      }),
    ],
    server: {
      // Dev-only proxy so local development never hits CORS issues.
      proxy: {
        '/api/celestrak': {
          target: 'https://celestrak.org',
          changeOrigin: true,
          rewrite: (path: string) => path.replace(/^\/api\/celestrak/, ''),
        },
      },
    },
    worker: {
      format: 'es',
    },
    build: {
      chunkSizeWarningLimit: 6000,
    },
  };
});
