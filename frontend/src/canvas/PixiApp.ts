import { Application, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export interface CityLayers {
  terrain: Container;
  infra: Container;
  zoning: Container;
  transit: Container;
  recommendation: Container;
  selection: Container;
}

export interface CityCanvas {
  app: Application;
  viewport: Viewport;
  layers: CityLayers;
  destroy: () => void;
}

export async function createCityCanvas(host: HTMLDivElement): Promise<CityCanvas> {
  const app = new Application();
  await app.init({
    resizeTo: host,
    backgroundColor: 0x1a1a1a,
    antialias: true,
  });
  host.appendChild(app.canvas);

  const viewport = new Viewport({
    screenWidth: host.clientWidth,
    screenHeight: host.clientHeight,
    worldWidth: 10000,
    worldHeight: 10000,
    events: app.renderer.events,
  });
  app.stage.addChild(viewport);
  viewport.drag().pinch().wheel().decelerate();
  viewport.clampZoom({ minScale: 0.05, maxScale: 4 });
  viewport.clamp({ left: 0, right: 10000, top: 0, bottom: 10000 });
  viewport.fitWorld(true); // whole 5x5 tile grid visible on first paint, not just the top-left corner

  // pixi-viewport's screenWidth/screenHeight are fixed at construction — app.init's
  // resizeTo keeps the *renderer* in sync with the host div, but the viewport itself
  // (what pans/zooms) goes stale on any later resize (DevTools opening/closing, window
  // resize), leaving pan/zoom clamped to the old, often much smaller, dimensions.
  const resizeObserver = new ResizeObserver(() => {
    viewport.resize(host.clientWidth, host.clientHeight);
  });
  resizeObserver.observe(host);

  // TODO: LOD switch (per-tile summary vs per-cell detail) keyed off viewport.scale.x
  const layers: CityLayers = {
    terrain: new Container(),
    infra: new Container(),
    zoning: new Container(),
    transit: new Container(),
    recommendation: new Container(),
    selection: new Container(),
  };
  viewport.addChild(
    layers.terrain,
    layers.infra,
    layers.zoning,
    layers.transit,
    layers.recommendation,
    layers.selection
  );

  return {
    app,
    viewport,
    layers,
    destroy: () => {
      resizeObserver.disconnect();
      app.destroy(true, { children: true });
    },
  };
}
