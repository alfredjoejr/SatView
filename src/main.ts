import 'cesium/Build/Cesium/Widgets/widgets.css';
import './styles/base.css';
import './styles/sidebar.css';
import './styles/overlays.css';
import './styles/cesium-overrides.css';

import { App } from './app/App';

// Cesium loads workers/assets relative to this URL (value injected by Vite).
(window as unknown as { CESIUM_BASE_URL: string }).CESIUM_BASE_URL = CESIUM_BASE_URL;

const app = new App();
app.start().catch((err: unknown) => {
  console.error('[SatView] failed to start', err);
  const loading = document.getElementById('loading');
  if (loading) {
    loading.classList.remove('hidden');
    loading.textContent = `SatView failed to start: ${(err as Error)?.message ?? err}`;
  }
});
