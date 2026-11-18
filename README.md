# SatView

Open-source 3D satellite tracker focused on **Starlink** and built to expand to additional constellations in the future. Powered by **CesiumJS**, **satellite.js** (SGP4/SDP4 orbital propagation), and **CelesTrak** public OMM GP orbital data—with no proprietary API keys or Cesium ion account required.

## Features

- **Full-Globe 3D Satellite View**: Tracks thousands of Starlink satellites across the globe in real time using GPU point primitives and Cesium's bundled Natural Earth II imagery.
- **Your Location & Elevation Mask**: Set your observer location via browser GPS, manual latitude/longitude entry, or clicking directly on the 3D globe. Configure a minimum elevation mask (default 25° for Starlink terminals) to see your coverage footprint and live link lines.
- **Satellites Above Me**:
  - **2D Polar Sky Plot**: Live azimuth/elevation radar view centered on your zenith with clickable satellite markers.
  - **Overhead Now Table**: Sorted list of satellites currently above your elevation mask with live elevation, azimuth, and slant range.
- **Dish Placement Guide**: Samples the next 30 minutes of satellite passes across 12 azimuth sectors to highlight the direction and angular sweep where a Starlink dish most needs an unobstructed view of the sky.
- **Orbit Path & Pass Prediction**: Select any satellite from the globe, search bar, sky plot, or overhead list to view its orbital path, telemetry, and next predicted pass (AOS/Peak/LOS).
- **Extensible Constellation Registry**: Add future constellations (e.g., OneWeb, Amazon Leo, GPS) by configuring entries in `src/config/constellations.ts`.

## Project Structure

Files are organized by responsibility into focused modules, each kept well under 500 lines:

```text
src/
├── app/                   # Application composition root & UI context interface
├── config/                # App-wide tunables and constellation registry
├── core/
│   ├── data/              # CelesTrak OMM client, IndexedDB cache, catalog loader
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

```bash
# Install dependencies
npm install

# Start the development server (includes /api/celestrak dev proxy)
npm run dev

# Typecheck and build for production
npm run build

# Preview the production build locally
npm run preview
```
