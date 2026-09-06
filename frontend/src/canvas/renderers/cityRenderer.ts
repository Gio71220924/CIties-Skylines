import { Graphics } from 'pixi.js';
import type { CityLayers } from '../PixiApp';
import { useCityStore } from '../../store/cityStore';
import { renderTerrainLayer } from '../layers/TerrainLayer';
import { renderInfraLayer } from '../layers/InfraLayer';
import { renderZoningLayer } from '../layers/ZoningLayer';
import { renderTransitLayer } from '../layers/TransitLayer';

// Full redraw on every store change — tile/road/parcel counts stay small enough per
// unlock (a few hundred parcels, a few dozen road edges) that this is simpler and fast
// enough for the MVP. Revisit with incremental updates if it ever shows up in profiling.
export function attachCityRenderer(layers: CityLayers): () => void {
  const terrainGfx = new Graphics();
  const infraGfx = new Graphics();
  const zoningGfx = new Graphics();
  const transitGfx = new Graphics();
  layers.terrain.addChild(terrainGfx);
  layers.infra.addChild(infraGfx);
  layers.zoning.addChild(zoningGfx);
  layers.transit.addChild(transitGfx);

  const draw = () => {
    const state = useCityStore.getState();
    renderTerrainLayer(terrainGfx, state.tiles);
    renderInfraLayer(infraGfx, state.roadGraph);
    renderZoningLayer(zoningGfx, state.parcels.values());
    renderTransitLayer(transitGfx, state.transitLines);
  };

  draw();
  const unsubscribe = useCityStore.subscribe(draw);

  return () => {
    unsubscribe();
    terrainGfx.destroy();
    infraGfx.destroy();
    zoningGfx.destroy();
    transitGfx.destroy();
  };
}
