import distance from '@turf/distance';
import type { Map as MapLibre } from 'maplibre-gl';
import { drawStore } from './drawStore';
import { undoStack } from './undoStack';
import { recomputeAll } from './routeComposer';
import { showToast } from '../ui/toast';
import type { LngLat } from '../util/coord';

const SAMPLE_DISTANCE_M = 30;
const MAX_WAYPOINTS = 40;

let map: MapLibre | null = null;
let overlay: HTMLDivElement | null = null;
let isCapturing = false;
let lastCapture: LngLat | null = null;
let rafPending = false;
let pendingLngLat: LngLat | null = null;

function genId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function metersBetween(a: LngLat, b: LngLat): number {
  return (
    distance(
      { type: 'Feature', geometry: { type: 'Point', coordinates: a }, properties: {} },
      { type: 'Feature', geometry: { type: 'Point', coordinates: b }, properties: {} },
      { units: 'meters' }
    ) as number
  );
}

function onPointerDown(e: PointerEvent): void {
  if (drawStore.getState().mode !== 'draw') return;
  e.preventDefault();

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (!map) return;

  const lngLat = map.unproject([x, y]);
  const ll: LngLat = [lngLat.lng, lngLat.lat];

  isCapturing = true;
  lastCapture = ll;

  const point = { id: genId(), lng: ll[0], lat: ll[1] };
  drawStore.startDrag();
  drawStore.addDragCapture(ll);
  drawStore.addPoint(point);

  overlay?.setPointerCapture(e.pointerId);
}

function onPointerMove(e: PointerEvent): void {
  if (!isCapturing || !map || !overlay) return;
  e.preventDefault();

  const rect = overlay.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const lngLat = map.unproject([x, y]);
  pendingLngLat = [lngLat.lng, lngLat.lat];

  if (!rafPending) {
    rafPending = true;
    requestAnimationFrame(processMove);
  }
}

function processMove(): void {
  rafPending = false;
  if (!isCapturing || !pendingLngLat || !lastCapture) return;

  const ll = pendingLngLat;
  const meters = metersBetween(lastCapture, ll);

  const state = drawStore.getState();
  if (state.dragCapture.length >= MAX_WAYPOINTS) {
    showToast('경로가 충분히 길어요. 손을 떼면 계산을 시작할게요.', 'info');
    return;
  }

  if (meters >= SAMPLE_DISTANCE_M) {
    lastCapture = ll;
    drawStore.addDragCapture(ll);
    const point = { id: genId(), lng: ll[0], lat: ll[1] };
    drawStore.addPoint(point);
  }
}

async function onPointerUp(e: PointerEvent): Promise<void> {
  if (!isCapturing) return;
  isCapturing = false;
  rafPending = false;
  pendingLngLat = null;
  lastCapture = null;

  overlay?.releasePointerCapture(e.pointerId);

  drawStore.endDrag();

  const state = drawStore.getState();
  const points = state.points;

  if (points.length < 2) return;

  undoStack.push({ t: 'dragBatch', points: [...points] });

  showToast('경로 계산 중…', 'info');
  await recomputeAll(points);
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

export function destroyDragMode(): void {
  isCapturing = false;
  map = null;
  overlay = null;
}
