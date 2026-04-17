import type { FeatureCollection, Feature, LineString } from 'geojson';
import { getMap } from './mapView';
import { SRC_OVERLAY, LYR_OVERLAY_LINES } from './layers';
import type { GeoJSONSource } from 'maplibre-gl';
import type { Course } from '../gallery/courses';

let selectedId: string | null = null;
let editingId: string | null = null;

export function loadOverlay(courses: Course[]): void {
  const map = getMap();
  const src = map.getSource(SRC_OVERLAY) as GeoJSONSource | undefined;
  if (!src) return;

  const features: Feature[] = courses
    .filter(c => c.routeSimplified)
    .map(c => ({
      type: 'Feature',
      id: c.id,
      geometry: c.routeSimplified as LineString,
      properties: { id: c.id, name: c.name, type: c.type },
    }));

  src.setData({ type: 'FeatureCollection', features } as FeatureCollection);
}

/** 버튼 클릭 시 해당 코스만 표시. null이면 모두 숨김 */
export function showOnlyCourse(id: string | null): void {
  selectedId = id;
  applyFilter();
}

export function setEditingCourse(id: string | null): void {
  editingId = id;
  applyFilter();
}

function applyFilter(): void {
  const map = getMap();
  if (!map.getLayer(LYR_OVERLAY_LINES)) return;

  if (!selectedId || selectedId === editingId) {
    map.setPaintProperty(LYR_OVERLAY_LINES, 'line-opacity', 0);
    map.setFilter(LYR_OVERLAY_LINES, null);
    return;
  }

  map.setFilter(LYR_OVERLAY_LINES, ['==', ['get', 'id'], selectedId]);
  map.setPaintProperty(LYR_OVERLAY_LINES, 'line-opacity', 0.9);
}
