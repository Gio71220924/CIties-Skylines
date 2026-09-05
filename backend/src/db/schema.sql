-- Postgres + PostGIS. Run once DB wiring replaces the in-memory route stubs.

CREATE TABLE cities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  owner_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CS1: fixed 5x5 grid = 25 tiles total, each 2km x 2km.
CREATE TABLE tiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  grid_x SMALLINT NOT NULL CHECK (grid_x BETWEEN 0 AND 4),
  grid_y SMALLINT NOT NULL CHECK (grid_y BETWEEN 0 AND 4),
  status TEXT NOT NULL DEFAULT 'locked' CHECK (status IN ('locked', 'unlocked')),
  unlock_milestone INTEGER NOT NULL DEFAULT 0,
  UNIQUE (city_id, grid_x, grid_y)
);

CREATE TABLE cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tile_id UUID NOT NULL REFERENCES tiles(id) ON DELETE CASCADE,
  local_x SMALLINT NOT NULL,
  local_y SMALLINT NOT NULL,
  zone_type TEXT NOT NULL DEFAULT 'none',
  is_recommended BOOLEAN NOT NULL DEFAULT false,
  road_adjacent BOOLEAN NOT NULL DEFAULT false,
  transit_adjacent BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (tile_id, local_x, local_y)
);

CREATE TABLE infra_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- road_local, road_arterial, rail, metro, bus_line
  is_stub BOOLEAN NOT NULL DEFAULT false,
  geom geometry(LineString, 4326)
);

CREATE TABLE transit_nodes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
  cell_id UUID REFERENCES cells(id),
  type TEXT NOT NULL -- bus_stop, metro_station, train_station
);
