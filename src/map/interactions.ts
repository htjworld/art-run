import type {
  Map as MapLibre,
  MapLayerMouseEvent,
  MapLayerTouchEvent,
} from 'maplibre-gl';
import { LYR_POINTS } from './layers';
import {
  startPointDrag,
  movePointDrag,
  endPointDrag,
  isDraggingPoint,
} from '../draw/pointMode';
import { drawStore } from '../draw/drawStore';
import { undoStack } from '../draw/undoStack';
import { routeStore, setDrawnSegment, routePair } from '../draw/routeComposer';
import bbox from '@turf/bbox';
import { showToast } from '../ui/toast';
import { getComposedLine } from '../draw/routeComposer';

let map: MapLibre | null = null;
let longPressTimer: ReturnType<typeof setTimeout> | null = null;

export function initInteractions(mapInstance: MapLibre): void {
  map = mapInstance;

  // 점 마커 호버 커서
  map.on('mouseenter', LYR_POINTS, () => {
    if (map && drawStore.getState().mode === 'point') {
      map.getCanvas().style.cursor = 'grab';
    }
  });
  map.on('mouseleave', LYR_POINTS, () => {
    if (map && !isDraggingPoint()) {
      map.getCanvas().style.cursor = '';
    }
  });

  // 점 마커 드래그 (데스크톱)
  map.on('mousedown', LYR_POINTS, (e: MapLayerMouseEvent) => {
    if (drawStore.getState().mode !== 'point') return;
    const feature = e.features?.[0];
    if (!feature) return;
    const pointId = feature.properties?.id as string;

    e.preventDefault();
    startPointDrag(pointId);

    const onMove = (moveE: MapLayerMouseEvent) => {
      movePointDrag(moveE.lngLat.lng, moveE.lngLat.lat);
    };
    const onUp = () => {
      endPointDrag();
      map!.off('mousemove', onMove);
      map!.off('mouseup', onUp);
    };
    map!.on('mousemove', onMove);
    map!.on('mouseup', onUp);
  });

  // 점 마커 터치 드래그 (모바일)
  map.on('touchstart', LYR_POINTS, (e: MapLayerTouchEvent) => {
    if (drawStore.getState().mode !== 'point') return;
    if (e.points.length !== 1) return;
    const feature = e.features?.[0];
    if (!feature) return;
    const pointId = feature.properties?.id as string;

    e.preventDefault();
    startPointDrag(pointId);

    longPressTimer = setTimeout(() => {
      deletePoint(pointId);
      endPointDrag();
    }, 600);

    const onMove = (moveE: MapLayerTouchEvent) => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      if (moveE.lngLat) {
        movePointDrag(moveE.lngLat.lng, moveE.lngLat.lat);
      }
    };
    const onUp = () => {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
      endPointDrag();
      map!.off('touchmove', onMove);
      map!.off('touchend', onUp);
    };
    map!.on('touchmove', onMove);
    map!.on('touchend', onUp);
  });

  // 점 더블클릭 삭제 (데스크톱)
  map.on('dblclick', LYR_POINTS, (e: MapLayerMouseEvent) => {
    if (drawStore.getState().mode !== 'point') return;
    const feature = e.features?.[0];
    if (!feature) return;
    e.preventDefault();
    deletePoint(feature.properties?.id as string);
  });

  // 키보드 단축키
  document.addEventListener('keydown', onKeyDown);
}

function deletePoint(id: string): void {
  const state = drawStore.getState();
  const idx = state.points.findIndex(p => p.id === id);
  if (idx < 0) return;
  undoStack.push({ t: 'delete', index: idx, point: state.points[idx] });
  drawStore.removePoint(id);
  routeStore.removeSegmentsForPoint(id);
}

function onKeyDown(e: KeyboardEvent): void {
  const meta = e.metaKey || e.ctrlKey;

  if (meta && e.shiftKey && e.key === 'z') {
    e.preventDefault();
    applyRedo();
  } else if (meta && e.key === 'z') {
    e.preventDefault();
    applyUndo();
  } else if (e.key === 'Escape') {
    const mode = drawStore.getState().mode;
    if (mode !== 'idle') drawStore.setMode('idle');
  }
}

function applyUndo(): void {
  const op = undoStack.undo();
  if (!op) return;
  const state = drawStore.getState();

  switch (op.t) {
    case 'add':
      drawStore.removePoint(op.point.id);
      routeStore.removeSegmentsForPoint(op.point.id);
      break;
    case 'delete': {
      const pts = [...state.points];
      pts.splice(op.index, 0, op.point);
      drawStore.setPoints(pts);
      break;
    }
    case 'drawBatch': {
      const pts = drawStore.getState().points.filter(
        p => p.id !== op.startPoint.id && p.id !== op.endPoint.id,
      );
      drawStore.setPoints(pts);
      routeStore.removeSegmentsForPoint(op.startPoint.id);
      routeStore.removeSegmentsForPoint(op.endPoint.id);
      break;
    }
    case 'clear':
      drawStore.setPoints(op.prev);
      routeStore.clear();
      break;
  }
}

function applyRedo(): void {
  const op = undoStack.redo();
  if (!op) return;

  switch (op.t) {
    case 'add':
      drawStore.addPoint(op.point);
      break;
    case 'delete':
      drawStore.removePoint(op.point.id);
      routeStore.removeSegmentsForPoint(op.point.id);
      break;
    case 'drawBatch': {
      const currentPts = drawStore.getState().points;
      drawStore.setPoints([...currentPts, op.startPoint, op.endPoint]);
      setDrawnSegment(op.startPoint, op.endPoint, op.drawnCoords);
      if (op.prevPointId) {
        const prev = currentPts.find(p => p.id === op.prevPointId);
        if (prev) void routePair(prev, op.startPoint);
      }
      break;
    }
    case 'clear':
      drawStore.clear();
      routeStore.clear();
      break;
  }
}

export function fitToBounds(): void {
  const m = map;
  if (!m) return;
  const state = drawStore.getState();
  const points = state.points;
  if (points.length < 2) {
    showToast('점을 2개 이상 찍어야 경계를 맞출 수 있어요.', 'info');
    return;
  }

  const line = getComposedLine(points);
  if (!line) {
    showToast('경로가 계산된 후 사용할 수 있어요.', 'info');
    return;
  }

  const [minX, minY, maxX, maxY] = bbox(line) as [number, number, number, number];
  m.fitBounds([[minX, minY], [maxX, maxY]], { padding: 80, maxZoom: 17 });
}

