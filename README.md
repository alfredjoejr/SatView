# SatView

Open-source 3D satellite tracker focused on **Starlink** and built to expand to additional constellations in the future. Powered by a **Node.js + TypeScript** backend (`server/`) for CelesTrak OMM caching and orbital pass/coverage calculations, paired with a **CesiumJS + satellite.js** 3D globe frontend (`src/`)—with no proprietary API keys or Cesium ion account required.

## Features

- **Full-Globe 3D Satellite View**: Tracks thousands of Starlink satellites across the globe in real time using GPU point primitives and Cesium's bundled Natural Earth II imagery.
- **Node.js + TypeScript Backend (`server/`)**: Fetches and caches CelesTrak GP OMM catalogs in memory and on disk (`.cache/`), computes 30-minute dish-placement sky coverage, calculates visible satellites, and predicts upcoming passes.
- **Your Location & Elevation Mask**: Set your observer location via browser GPS, manual latitude/longitude entry, or clicking directly on the 3D globe. Configure a minimum elevation mask (default 25° for Starlink terminals) to see your coverage footprint and live link lines.
- **Satellites Above Me**:
  - **2D Polar Sky Plot**: Live azimuth/elevation radar view centered on your zenith with clickable satellite markers.
  - **Overhead Now Table**: Sorted list of satellites currently above your elevation mask with live elevation, azimuth, and slant range.
- **Dish Placement Guide**: Samples the next 30 minutes of satellite passes across 12 azimuth sectors via `/api/observer/coverage` to highlight the direction and angular sweep where a Starlink dish most needs an unobstructed view of the sky.
- **Orbit Path & Pass Prediction**: Select any satellite from the globe, search bar, sky plot, or overhead list to view its orbital path, telemetry, and next predicted pass (`/api/satellites/:noradId/pass`).
- **Extensible Constellation Registry**: Add future constellations (e.g., OneWeb, Amazon Leo, GPS) by configuring entries in `src/config/constellations.ts`.

## Backend API Endpoints

- `GET /api/health` — Backend uptime and status check.
- `GET /api/constellations` — Supported constellation registry.
- `GET /api/catalog/:group` (`?refresh=1`) — Cached CelesTrak OMM GP catalog for a constellation group.
- `GET /api/observer/visible` (`?group=starlink&lat=...&lon=...&maskDeg=25`) — Satellites currently above the observer's elevation mask.
- `GET /api/observer/coverage` (`?group=starlink&lat=...&lon=...&maskDeg=25&windowMinutes=30`) — Azimuth sector sky density analysis for dish positioning.
- `GET /api/satellites/:noradId/pass` (`?group=starlink&lat=...&lon=...&maskDeg=25`) — Next pass (AOS/Peak/LOS) for a satellite.

## Project Structure

Files are organized by responsibility into focused modules, each kept well under 500 lines:

```text
server/
├── app.ts                 # Shared API router & CORS / error handling
├── config.ts              # Server port, disk cache paths, CelesTrak & orbit defaults
├── httpUtils.ts           # Query parsing, HttpError, JSON response helpers
├── index.ts               # Standalone HTTP server + static dist/ host
├── routes/                # Catalog, health, observer visibility, coverage & pass routes
├── services/              # CelesTrak disk/memory cache & SGP4 orbit computation services
└── types.ts               # Backend API response & OMM interfaces
src/
├── app/                   # Application composition root & UI context interface
├── config/                # App-wide tunables and constellation registry
├── core/
│   ├── data/              # Backend catalog client, IndexedDB offline cache, catalog loader
│   ├── events/            # Strongly-typed EventBus and event definitions
│   ├── observer/          # Browser geolocation, manual input, localStorage persistence
│   ├── orbit/             # SGP4 propagation, look angles, visibility, pass & coverage analysis
│   ├── simulation/        # Flat typed-array simulation step state
│   └── state/             # Central AppStore state management
├── globe/
│   └── layers/            # Cesium viewer setup, camera helpers, satellite/observer/orbit layers
├── styles/                # Modular dark-theme CSS (base, sidebar, overlays, Cesium overrides)
├── ui/
│   ├── canvas/            # HiDPI 2D polar sky-plot drawing helpers
│   └── components/        # Modular UI panels (Header, LocationPanel, SkyPlot, DishGuide, etc.)
└── utils/                 # Formatting, geometry, and async browser-yield helpers
```

## Getting Started

### Single-Command Launchers (Frontend + Backend)

- **PowerShell (Windows / macOS / Linux):** `.\start.ps1`
- **Windows Command Prompt / Explorer:** `start.bat`
- **Linux / macOS (Bash):** `./start.sh`
- **npm:** `npm run dev`

All launchers automatically install `node_modules` if missing, then start both the **Node.js backend** (`http://127.0.0.1:3001`) and **Vite frontend** (`http://localhost:5173`, proxying `/api/*` to the backend).

### Individual Commands

```bash
# Install dependencies
npm install

# Start both backend + frontend together
npm run dev

# Or run separately in two terminals:
npm run dev:backend
npm run dev:frontend

# Typecheck and build for production
npm run build

# Run the standalone Node.js production server (serves dist/ and /api/* on port 3001)
npm start
```
