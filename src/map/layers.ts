import type {
  LayerSpecification,
  CircleLayerSpecification,
  LineLayerSpecification,
  SymbolLayerSpecification,
} from 'maplibre-gl';

// ─── Source IDs ──────────────────────────────────────────────
export const SRC_OVERLAY = 'courses-overlay';
export const SRC_ROUTE = 'draw-route';
export const SRC_PENDING = 'draw-pending';
export const SRC_ERROR = 'draw-error';
export const SRC_POINTS = 'draw-points';

// ─── Layer IDs ───────────────────────────────────────────────
export const LYR_OVERLAY_HALO = 'overlay-halo';
export const LYR_OVERLAY_ARTRUN = 'overlay-artrun';
export const LYR_OVERLAY_SCENIC = 'overlay-scenic';
export const LYR_OVERLAY_SYMBOLS = 'overlay-symbols';
export const LYR_ROUTE_PENDING = 'route-pending';
export const LYR_ROUTE_ERROR = 'route-error';
export const LYR_ROUTE_HALO = 'route-halo';
export const LYR_ROUTE_DONE = 'route-done';
export const LYR_POINTS_HALO = 'points-halo';
export const LYR_POINTS = 'points';
export const LYR_POINTS_LABEL = 'points-label';

// ─── Layer 정의 ───────────────────────────────────────────────

export const overlayHaloLayer: LineLayerSpecification = {
  id: LYR_OVERLAY_HALO,
  type: 'line',
  source: SRC_OVERLAY,
  minzoom: 10,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 9,
    'line-opacity': 0,
  },
};

export const overlayArtrunLayer: LineLayerSpecification = {
  id: LYR_OVERLAY_ARTRUN,
  type: 'line',
  source: SRC_OVERLAY,
  minzoom: 10,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#242424',
    'line-width': 5,
    'line-opacity': 0,
    'line-dasharray': [4, 3],
  },
};

export const overlayScenicLayer: LineLayerSpecification = {
  id: LYR_OVERLAY_SCENIC,
  type: 'line',
  source: SRC_OVERLAY,
  minzoom: 10,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#242424',
    'line-width': 5,
    'line-opacity': 0,
  },
};

export const overlaySymbolsLayer: SymbolLayerSpecification = {
  id: LYR_OVERLAY_SYMBOLS,
  type: 'symbol',
  source: SRC_OVERLAY,
  maxzoom: 10,
  layout: {
    'text-field': ['get', 'name'],
    'text-size': 11,
    'text-anchor': 'top',
    'text-offset': [0, 0.5],
    'symbol-placement': 'point',
  },
  paint: {
    'text-color': '#242424',
    'text-halo-color': '#FFFFFF',
    'text-halo-width': 1.5,
  },
};

export const routePendingLayer: LineLayerSpecification = {
  id: LYR_ROUTE_PENDING,
  type: 'line',
  source: SRC_PENDING,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#9CA3AF',
    'line-width': 3,
    'line-dasharray': [2, 2],
    'line-opacity': 0.8,
  },
};

export const routeErrorLayer: LineLayerSpecification = {
  id: LYR_ROUTE_ERROR,
  type: 'line',
  source: SRC_ERROR,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#EF4444',
    'line-width': 3,
    'line-dasharray': [2, 2],
    'line-opacity': 0.8,
  },
};

export const routeHaloLayer: LineLayerSpecification = {
  id: LYR_ROUTE_HALO,
  type: 'line',
  source: SRC_ROUTE,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#FFFFFF',
    'line-width': 9,
    'line-opacity': 0.9,
  },
};

export const routeDoneLayer: LineLayerSpecification = {
  id: LYR_ROUTE_DONE,
  type: 'line',
  source: SRC_ROUTE,
  layout: { 'line-cap': 'round', 'line-join': 'round' },
  paint: {
    'line-color': '#242424',
    'line-width': 5,
  },
};

export const pointsHaloLayer: CircleLayerSpecification = {
  id: LYR_POINTS_HALO,
  type: 'circle',
  source: SRC_POINTS,
  paint: {
    'circle-color': '#FFFFFF',
    'circle-radius': 10,
  },
};

export const pointsLayer: CircleLayerSpecification = {
  id: LYR_POINTS,
  type: 'circle',
  source: SRC_POINTS,
  paint: {
    'circle-color': '#242424',
    'circle-radius': 7,
    'circle-stroke-color': '#FFFFFF',
    'circle-stroke-width': 1.5,
  },
};

export const pointsLabelLayer: SymbolLayerSpecification = {
  id: LYR_POINTS_LABEL,
  type: 'symbol',
  source: SRC_POINTS,
  layout: {
    'text-field': ['to-string', ['get', 'index']],
    'text-size': 10,
    'text-anchor': 'center',
    'text-allow-overlap': true,
    'text-ignore-placement': true,
  },
  paint: {
    'text-color': '#242424',
  },
};

export const ALL_LAYERS: LayerSpecification[] = [
  overlayHaloLayer,
  overlayArtrunLayer,
  overlayScenicLayer,
  overlaySymbolsLayer,
  routePendingLayer,
  routeErrorLayer,
  routeHaloLayer,
  routeDoneLayer,
  pointsHaloLayer,
  pointsLayer,
  pointsLabelLayer,
];
