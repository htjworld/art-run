import type { Map as MapLibre, MapMouseEvent } from 'maplibre-gl';
import { drawStore } from './drawStore';
import { undoStack } from './undoStack';
import { recomputeAdjacent } from './routeComposer';
import { debounce } from './debounce';
import { lngLatFromMapLibre } from '../util/coord';

let map: MapLibre | null = null;
let cleanup: (() => void)[] = [];
let draggingPointId: string | null = null;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function onMapClick(e: MapMouseEvent & { defaultPrevented?: boolean }): void {
  if (drawStore.getState().mode !== 'point') return;
  if (draggingPointId) return;

  const [lng, lat] = lngLatFromMapLibre(e.lngLat);
  const point = { id: genId(), lng, lat };

  undoStack.push({ t: 'add', point });
  drawStore.addPoint(point);

  const points = drawStore.getState().points;
  if (points.length >= 2) {
    void recomputeAdjacent(points, point.id);
  }
}

const debouncedRecompute = debounce((pointId: string) => {
  const points = drawStore.getState().points;
  void recomputeAdjacent(points, pointId);
}, 300);

export function startPointDrag(pointId: string): void {
  if (!map) return;
  draggingPointId = pointId;
  map.dragPan.disable();
  map.getCanvas().style.cursor = 'grabbing';
}

export function movePointDrag(lng: number, lat: number): void {
  if (!draggingPointId) return;
  drawStore.updatePoint(draggingPointId, lng, lat);
}

export function endPointDrag(): void {
  if (!draggingPointId || !map) return;
  const id = draggingPointId;
  draggingPointId = null;
  map.dragPan.enable();
  map.getCanvas().style.cursor = '';

  const state = drawStore.getState();
  const point = state.points.find(p => p.id === id);
  if (point) {
    // Undo 기록은 dragEnd 시 처리 (이동량 저장은 별도 추적 필요)
    debouncedRecompute(id);
  }
}

export function isDraggingPoint(): boolean {
  return draggingPointId !== null;
}

export function initPointMode(mapInstance: MapLibre): void {
  map = mapInstance;

  const clickHandler = (e: MapMouseEvent) => onMapClick(e);
  map.on('click', clickHandler);
  cleanup.push(() => map!.off('click', clickHandler));
}

export function destroyPointMode(): void {
  cleanup.forEach(fn => fn());
  cleanup = [];
  debouncedRecompute.cancel();
  map = null;
}
