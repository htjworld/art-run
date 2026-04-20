import type { FeatureCollection, Feature, LineString } from 'geojson';
import { getMap } from './mapView';
import { SRC_OVERLAY, LYR_OVERLAY_HALO, LYR_OVERLAY_ARTRUN, LYR_OVERLAY_SCENIC } from './layers';
import type { GeoJSONSource, FilterSpecification } from 'maplibre-gl';
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

const OVERLAY_LAYERS = [LYR_OVERLAY_HALO, LYR_OVERLAY_ARTRUN, LYR_OVERLAY_SCENIC] as const;

function applyFilter(): void {
  const map = getMap();

  if (!OVERLAY_LAYERS.every(id => map.getLayer(id))) return;

  if (!selectedId || selectedId === editingId) {
    for (const lyr of OVERLAY_LAYERS) {
      map.setFilter(lyr, ['==', ['get', 'id'], ''] as FilterSpecification);
      map.setPaintProperty(lyr, 'line-opacity', 0);
    }
    return;
  }

  const idEq = ['==', ['get', 'id'], selectedId] as FilterSpecification;
  const artrunFilter = ['all', idEq, ['==', ['get', 'type'], 'artrun']] as FilterSpecification;
  const scenicFilter = ['all', idEq, ['==', ['get', 'type'], 'scenic']] as FilterSpecification;

  map.setFilter(LYR_OVERLAY_HALO, idEq);
  map.setPaintProperty(LYR_OVERLAY_HALO, 'line-opacity', 0.8);

  map.setFilter(LYR_OVERLAY_ARTRUN, artrunFilter);
  map.setPaintProperty(LYR_OVERLAY_ARTRUN, 'line-opacity', 0.95);

  map.setFilter(LYR_OVERLAY_SCENIC, scenicFilter);
  map.setPaintProperty(LYR_OVERLAY_SCENIC, 'line-opacity', 0.95);
}
