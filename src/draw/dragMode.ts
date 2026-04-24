import type { Map as MapLibre } from 'maplibre-gl';
import { drawStore } from './drawStore';
import { undoStack } from './undoStack';
import { setDrawnSegment, routePair } from './routeComposer';
import type { LngLat } from '../util/coord';
import type { Point } from './drawStore';

let map: MapLibre | null = null;
let overlay: HTMLDivElement | null = null;
let isCapturing = false;
let capturedCoords: LngLat[] = [];
let rafPending = false;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function screenToLngLat(clientX: number, clientY: number, rect: DOMRect): LngLat | null {
  if (!map) return null;
  const { lng, lat } = map.unproject([clientX - rect.left, clientY - rect.top]);
  return [lng, lat];
}

function onPointerDown(e: PointerEvent): void {
  if (drawStore.getState().mode !== 'draw') return;
  e.preventDefault();
  if (!overlay) return;

  const ll = screenToLngLat(e.clientX, e.clientY, overlay.getBoundingClientRect());
  if (!ll) return;

  capturedCoords = [ll];
  isCapturing = true;

  drawStore.startDrag();
  overlay.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  if (!isCapturing || !overlay) return;
  e.preventDefault();

  const ll = screenToLngLat(e.clientX, e.clientY, overlay.getBoundingClientRect());
  if (!ll) return;

  capturedCoords.push(ll);

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(() => {
      rafPending = false;
      if (capturedCoords.length >= 2) {
        drawStore.setDragCapture([...capturedCoords]);
      }
    });
  }
}

async function onPointerUp(e: PointerEvent): Promise<void> {
  if (!isCapturing) return;
  isCapturing = false;
  rafPending = false;

  overlay?.releasePointerCapture(e.pointerId);
  drawStore.endDrag(); // 프리뷰 라인 클리어

  const coords = capturedCoords;
  capturedCoords = [];

  if (coords.length < 2) return;

  const existingPoints = [...drawStore.getState().points];
  const prevPoint: Point | null = existingPoints.length > 0
    ? existingPoints[existingPoints.length - 1]
    : null;

  const startPoint: Point = { id: genId(), lng: coords[0][0], lat: coords[0][1] };
  const endPoint: Point = { id: genId(), lng: coords[coords.length - 1][0], lat: coords[coords.length - 1][1] };

  drawStore.setPoints([...existingPoints, startPoint, endPoint]);
  setDrawnSegment(startPoint, endPoint, coords);

  undoStack.push({
    t: 'drawBatch',
    startPoint,
    endPoint,
    drawnCoords: coords,
    prevPointId: prevPoint?.id ?? null,
  });

  // 이전 점 → 그리기 시작점 ORS 연결
  if (prevPoint) {
    void routePair(prevPoint, startPoint);
  }
}

export function initDragMode(mapInstance: MapLibre, overlayEl: HTMLDivElement): void {
  map = mapInstance;
  overlay = overlayEl;

  overlayEl.addEventListener('pointerdown', onPointerDown);
  overlayEl.addEventListener('pointermove', onPointerMove);
  overlayEl.addEventListener('pointerup', e => void onPointerUp(e));
  overlayEl.addEventListener('pointercancel', e => void onPointerUp(e));
}

export function setDragOverlayActive(active: boolean): void {
  if (!overlay) return;
  overlay.style.pointerEvents = active ? 'all' : 'none';
  overlay.style.cursor = active ? 'crosshair' : '';
}

