import type { LineString } from 'geojson';
import type { LngLat } from '../util/coord';
import { coordKey } from '../util/coord';
import type { Point } from './drawStore';
import type { RoutingProvider } from '../routing/provider';
import { RoutingError } from '../routing/provider';
import { routeWithRetry } from '../routing/orsClient';
import { showToast } from '../ui/toast';

// 동일 에러 3초 내 중복 토스트 방지
const lastToastAt = new Map<string, number>();
function showRoutingError(msg: string, kind: string): void {
  const now = Date.now();
  if ((now - (lastToastAt.get(kind) ?? 0)) > 3000) {
    lastToastAt.set(kind, now);
    showToast(msg, 'error');
  }
}

export interface Segment {
  key: string;
  fromId: string;
  toId: string;
  line: LineString;
  meters: number;
  status: 'done' | 'error';
  source?: 'ors' | 'draw';
}

export interface RouteState {
  segments: Map<string, Segment>;
  pending: Set<string>;
  totalMeters: number;
}

type RouteListener = (state: RouteState) => void;

const MAX_PARALLEL = 2;

function createRouteStore() {
  let state: RouteState = {
    segments: new Map(),
    pending: new Set(),
    totalMeters: 0,
  };

  const listeners = new Set<RouteListener>();

  function notify(): void {
    listeners.forEach(fn => fn(state));
  }

  function recomputeTotal(): void {
    let total = 0;
    for (const seg of state.segments.values()) {
      if (seg.status === 'done') total += seg.meters;
    }
    state = { ...state, totalMeters: total };
  }

  return {
    getState: (): RouteState => state,

    subscribe(fn: RouteListener): () => void {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setPending(key: string): void {
      const pending = new Set(state.pending).add(key);
      state = { ...state, pending };
      notify();
    },

    setSegment(seg: Segment): void {
      const segments = new Map(state.segments).set(seg.key, seg);
      const pending = new Set(state.pending);
      pending.delete(seg.key);
      state = { ...state, segments, pending };
      recomputeTotal();
      notify();
    },

    removeSegmentsForPoint(pointId: string): void {
      const segments = new Map(state.segments);
      for (const [key, seg] of segments) {
        if (seg.fromId === pointId || seg.toId === pointId) {
          segments.delete(key);
        }
      }
      state = { ...state, segments };
      recomputeTotal();
      notify();
    },

    pruneToPoints(points: Point[]): void {
      const ids = new Set(points.map(p => p.id));
      const segments = new Map(state.segments);
      for (const [key, seg] of segments) {
        if (!ids.has(seg.fromId) || !ids.has(seg.toId)) {
          segments.delete(key);
        }
      }
      state = { ...state, segments };
      recomputeTotal();
      notify();
    },

    clear(): void {
      state = { segments: new Map(), pending: new Set(), totalMeters: 0 };
      notify();
    },
  };
}

export const routeStore = createRouteStore();

// 진행 중 요청 abort 컨트롤러 맵
const abortControllers = new Map<string, AbortController>();

let provider: RoutingProvider | null = null;

export function setRoutingProvider(p: RoutingProvider): void {
  provider = p;
}

function haversineMeters(coords: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    total += 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
  return total;
}

export function setDrawnSegment(from: Point, to: Point, coords: LngLat[]): void {
  const key = coordKey([from.lng, from.lat], [to.lng, to.lat]);
  routeStore.setSegment({
    key,
    fromId: from.id,
    toId: to.id,
    line: { type: 'LineString', coordinates: coords },
    meters: haversineMeters(coords),
    status: 'done',
    source: 'draw',
  });
}

export async function routePair(from: Point, to: Point): Promise<void> {
  await routeSegments([[from, to]]);
}

/** 완성된 세그먼트를 부분적으로 모아 표시 (ORS 계산 중에도 기존 경로 유지) */
export function getPartialLines(points: Point[]): LineString[] {
  if (points.length < 2) return [];
  const { segments } = routeStore.getState();
  const lines: LineString[] = [];
  let current: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const key = coordKey(
      [points[i].lng, points[i].lat],
      [points[i + 1].lng, points[i + 1].lat],
    );
    const seg = segments.get(key);
    if (seg?.status === 'done') {
      const segCoords = seg.line.coordinates as [number, number][];
      if (current.length === 0) current = [...segCoords];
      else current.push(...segCoords.slice(1));
    } else {
      if (current.length >= 2) lines.push({ type: 'LineString', coordinates: current });
      current = [];
    }
  }
  if (current.length >= 2) lines.push({ type: 'LineString', coordinates: current });
  return lines;
}

export function getComposedLine(points: Point[]): LineString | null {
  if (points.length < 2) return null;
  const coords: [number, number][] = [];
  const { segments } = routeStore.getState();

  for (let i = 0; i < points.length - 1; i++) {
    const key = coordKey(
      [points[i].lng, points[i].lat],
      [points[i + 1].lng, points[i + 1].lat]
    );
    const seg = segments.get(key);
    if (!seg || seg.status !== 'done') return null;
    const segCoords = seg.line.coordinates as [number, number][];
    if (i === 0) coords.push(...segCoords);
    else coords.push(...segCoords.slice(1));
  }

  return { type: 'LineString', coordinates: coords };
}

export function getPendingLines(
  points: Point[],
  dragCapture?: LngLat[]
): LineString[] {
  const lines: LineString[] = [];
  const { pending, segments } = routeStore.getState();

  for (let i = 0; i < points.length - 1; i++) {
    const from: LngLat = [points[i].lng, points[i].lat];
    const to: LngLat = [points[i + 1].lng, points[i + 1].lat];
    const key = coordKey(from, to);
    if (pending.has(key) || (!segments.has(key) && points.length > 1)) {
      lines.push({ type: 'LineString', coordinates: [from, to] });
    }
  }

  if (dragCapture && dragCapture.length >= 2) {
    lines.push({ type: 'LineString', coordinates: dragCapture });
  }

  return lines;
}

export function getErrorLines(points: Point[]): LineString[] {
  const lines: LineString[] = [];
  const { segments } = routeStore.getState();

  for (let i = 0; i < points.length - 1; i++) {
    const from: LngLat = [points[i].lng, points[i].lat];
    const to: LngLat = [points[i + 1].lng, points[i + 1].lat];
    const key = coordKey(from, to);
    const seg = segments.get(key);
    if (seg?.status === 'error') {
      lines.push({ type: 'LineString', coordinates: [from, to] });
    }
  }

  return lines;
}

/** 특정 점 주변의 세그먼트만 재계산 */
export async function recomputeAdjacent(
  points: Point[],
  changedId: string
): Promise<void> {
  const idx = points.findIndex(p => p.id === changedId);
  if (idx < 0) return;

  const pairs: [Point, Point][] = [];
  if (idx > 0) pairs.push([points[idx - 1], points[idx]]);
  if (idx < points.length - 1) pairs.push([points[idx], points[idx + 1]]);

  await routeSegments(pairs);
}

async function routeSegments(pairs: [Point, Point][]): Promise<void> {
  if (!provider) return;

  // 직접 그린 세그먼트는 ORS 재계산에서 제외
  const { segments: existing } = routeStore.getState();
  const toRoute = pairs.filter(([a, b]) => {
    const key = coordKey([a.lng, a.lat], [b.lng, b.lat]);
    return existing.get(key)?.source !== 'draw';
  });
  if (toRoute.length === 0) return;

  // 이전 요청 취소
  for (const [key, ctrl] of abortControllers) {
    for (const [a, b] of toRoute) {
      const k = coordKey([a.lng, a.lat], [b.lng, b.lat]);
      if (key === k) {
        ctrl.abort();
        abortControllers.delete(key);
      }
    }
  }

  // 병렬 실행 (MAX_PARALLEL 제한)
  const queue = [...toRoute];

  async function processOne(a: Point, b: Point): Promise<void> {
    const from: LngLat = [a.lng, a.lat];
    const to: LngLat = [b.lng, b.lat];
    const key = coordKey(from, to);

    const ctrl = new AbortController();
    abortControllers.set(key, ctrl);
    routeStore.setPending(key);

    try {
      const result = await routeWithRetry(provider!, from, to, ctrl.signal);
      routeStore.setSegment({
        key,
        fromId: a.id,
        toId: b.id,
        line: result.line,
        meters: result.meters,
        status: 'done',
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      // 에러 시 점 삭제 대신 에러 세그먼트로 유지 (빨간 점선 표시)
      routeStore.setSegment({
        key,
        fromId: a.id,
        toId: b.id,
        line: { type: 'LineString', coordinates: [[a.lng, a.lat], [b.lng, b.lat]] },
        meters: 0,
        status: 'error',
      });
      const kind = err instanceof RoutingError ? err.kind : 'unknown';
      const msg = err instanceof Error ? err.message : '경로 계산에 실패했어요.';
      showRoutingError(msg, kind);
    } finally {
      abortControllers.delete(key);
    }
  }

  // 6개 병렬 처리
  const running: Promise<void>[] = [];
  for (const [a, b] of queue) {
    if (running.length >= MAX_PARALLEL) {
      await Promise.race(running);
    }
    const p = processOne(a, b).then(() => {
      running.splice(running.indexOf(p), 1);
    });
    running.push(p);
  }
  await Promise.all(running);
}
