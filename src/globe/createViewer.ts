import {
  buildModuleUrl,
  ClockRange,
  Color,
  ImageryLayer,
  JulianDate,
  TileMapServiceImageryProvider,
  Viewer,
} from 'cesium';

const TIMELINE_SPAN_HOURS = 12;

/**
 * Create the 3D globe. Uses Cesium's bundled Natural Earth II imagery so the
 * app works fully open-source with no API keys or Cesium ion account.
 */
export function createViewer(container: HTMLElement): Viewer {
  const viewer = new Viewer(container, {
    baseLayer: ImageryLayer.fromProviderAsync(
      TileMapServiceImageryProvider.fromUrl(buildModuleUrl('Assets/Textures/NaturalEarthII')),
      {},
    ),
    baseLayerPicker: false,
    geocoder: false,
    homeButton: true,
    sceneModePicker: true,
    navigationHelpButton: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    animation: true,
    timeline: true,
    shouldAnimate: true,
  });

  const { scene } = viewer;
  scene.globe.enableLighting = true; // day/night terminator
  scene.globe.baseColor = Color.fromCssColorString('#0b1a2e');
  scene.fog.enabled = false;
  scene.screenSpaceCameraController.minimumZoomDistance = 50_000;
  scene.screenSpaceCameraController.maximumZoomDistance = 200_000_000;

  configureClock(viewer);
  return viewer;
}

function configureClock(viewer: Viewer): void {
  const now = JulianDate.now();
  const start = JulianDate.addHours(now, -TIMELINE_SPAN_HOURS, new JulianDate());
  const stop = JulianDate.addHours(now, TIMELINE_SPAN_HOURS, new JulianDate());

  const { clock } = viewer;
  clock.startTime = start;
  clock.stopTime = stop;
  clock.currentTime = now;
  clock.clockRange = ClockRange.UNBOUNDED;
  clock.multiplier = 1;
  clock.shouldAnimate = true;
  viewer.timeline?.zoomTo(start, stop);
}
