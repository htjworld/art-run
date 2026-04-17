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

export function setSelectedCourse(id: string | null): void {
  const map = getMap();
  if (selectedId) {
    map.setFeatureState({ source: SRC_OVERLAY, id: selectedId }, { selected: false });
  }
  selectedId = id;
  if (id) {
    map.setFeatureState({ source: SRC_OVERLAY, id }, { selected: true });
  }
}

export function setEditingCourse(id: string | null): void {
  editingId = id;
  applyEditingFilter();
}

function applyEditingFilter(): void {
  const map = getMap();
  if (!map.getLayer(LYR_OVERLAY_LINES)) return;

  if (editingId) {
    map.setFilter(LYR_OVERLAY_LINES, ['!=', ['get', 'id'], editingId]);
  } else {
    map.setFilter(LYR_OVERLAY_LINES, null);
  }
}
