import maplibregl, { Map, type GeoJSONSource, type LngLatBoundsLike } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { FeatureCollection, LineString, Point } from 'geojson';
import type { Course } from '../gallery/courses';
import {
  ALL_LAYERS,
  SRC_OVERLAY,
  SRC_POINTS,
  SRC_ROUTE,
  SRC_PENDING,
  SRC_ERROR,
} from './layers';

const INITIAL_CENTER: [number, number] = [126.978, 37.566];
const INITIAL_ZOOM = 12;

function getMapStyle(): string {
  const mapKey = import.meta.env.VITE_MAP_KEY as string | undefined;
  if (mapKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapKey}`;
  }
  return 'https://tiles.openfreemap.org/styles/liberty';
}

let mapInstance: Map | null = null;

export function getMap(): Map {
  if (!mapInstance) throw new Error('Map not initialized');
  return mapInstance;
}

export async function initMap(container: HTMLElement): Promise<Map> {
  const map = new maplibregl.Map({
    container,
    style: getMapStyle(),
    center: INITIAL_CENTER,
    zoom: INITIAL_ZOOM,
    dragRotate: false,
    pitchWithRotate: false,
    attributionControl: false,
    maxPitch: 0,
  });

  map.touchZoomRotate.disableRotation();

  map.addControl(
    new maplibregl.AttributionControl({ compact: true }),
    'bottom-right'
  );

  map.addControl(
    new maplibregl.NavigationControl({ showCompass: false }),
    'bottom-right'
  );

  map.addControl(
    new maplibregl.GeolocateControl({
      positionOptions: { enableHighAccuracy: true },
      trackUserLocation: false,
      showAccuracyCircle: false,
    }),
    'bottom-right',
  );

  await new Promise<void>((resolve, reject) => {
    map.once('load', () => resolve());
    map.once('error', reject);
  });

  // 베이스 맵 스타일의 누락 스프라이트 이미지 → 투명 1×1 placeholder로 대체
  map.on('styleimagemissing', (e: { id: string }) => {
    if (!e.id) return;
    map.addImage(e.id, { width: 1, height: 1, data: new Uint8Array(4) });
  });

  // 소스 등록
  map.addSource(SRC_OVERLAY, { type: 'geojson', data: emptyFC(), promoteId: 'id' });
  map.addSource(SRC_ROUTE, { type: 'geojson', data: emptyFC() });
  map.addSource(SRC_PENDING, { type: 'geojson', data: emptyFC() });
  map.addSource(SRC_ERROR, { type: 'geojson', data: emptyFC() });
  map.addSource(SRC_POINTS, { type: 'geojson', data: emptyFC() });

  // 레이어 등록 (순서: overlay → route → points)
  for (const layer of ALL_LAYERS) {
    map.addLayer(layer);
  }

  mapInstance = map;
  return map;
}

export function emptyFC(): FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function setGeoJSONData(sourceId: string, fc: FeatureCollection): void {
  const src = getMap().getSource(sourceId) as GeoJSONSource | undefined;
  src?.setData(fc);
}

export function updateRouteSource(lines: LineString[]): void {
  setGeoJSONData(SRC_ROUTE, {
    type: 'FeatureCollection',
    features: lines.map(line => ({ type: 'Feature', geometry: line, properties: {} })),
  });
}

export function updatePendingSource(lines: LineString[]): void {
  setGeoJSONData(SRC_PENDING, {
    type: 'FeatureCollection',
    features: lines.map(line => ({ type: 'Feature', geometry: line, properties: {} })),
  });
}

export function updateErrorSource(lines: LineString[]): void {
  setGeoJSONData(SRC_ERROR, {
    type: 'FeatureCollection',
    features: lines.map(line => ({ type: 'Feature', geometry: line, properties: {} })),
  });
}

export function updatePointsSource(
  points: { id: string; lng: number; lat: number }[]
): void {
  setGeoJSONData(SRC_POINTS, {
    type: 'FeatureCollection',
    features: points.map((p, i) => ({
      type: 'Feature',
      id: i,
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] } as Point,
      properties: { id: p.id, index: i + 1 },
    })),
  });
}

export function resizeMap(): void {
  mapInstance?.resize();
}

export function flyToPoint(lng: number, lat: number, zoom = 15): void {
  getMap().flyTo({ center: [lng, lat], zoom, duration: 1000, essential: true });
}

export function flyToCourse(course: Course): void {
  const map = getMap();
  if (course.route && course.route.coordinates.length >= 2) {
    const coords = course.route.coordinates as [number, number][];
    const lngs = coords.map(c => c[0]);
    const lats = coords.map(c => c[1]);
    const bounds: LngLatBoundsLike = [
      [Math.min(...lngs), Math.min(...lats)],
      [Math.max(...lngs), Math.max(...lats)],
    ];
    map.fitBounds(bounds, { padding: 80, maxZoom: 14, duration: 1200, essential: true });
  } else {
    map.flyTo({ center: course.center, zoom: course.zoom, duration: 1200, essential: true });
  }
}
