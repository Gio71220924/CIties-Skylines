import { Application, Container } from 'pixi.js';
import { Viewport } from 'pixi-viewport';

export interface CityLayers {
  terrain: Container;
  infra: Container;
  zoning: Container;
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

  // TODO: LOD switch (per-tile summary vs per-cell detail) keyed off viewport.scale.x
  const layers: CityLayers = {
    terrain: new Container(),
    infra: new Container(),
    zoning: new Container(),
    recommendation: new Container(),
    selection: new Container(),
  };
  viewport.addChild(layers.terrain, layers.infra, layers.zoning, layers.recommendation, layers.selection);

  return {
    app,
    viewport,
    layers,
    destroy: () => app.destroy(true, { children: true }),
  };
}
