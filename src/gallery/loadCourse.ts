import type { Course } from './courses';
import { drawStore } from '../draw/drawStore';
import { routeStore } from '../draw/routeComposer';
import { undoStack } from '../draw/undoStack';
import { setEditingCourse } from '../map/overlay';
import { getMap } from '../map/mapView';
import { cacheSet } from '../routing/segmentCache';
import type { LineString } from 'geojson';
import type { LngLat } from '../util/coord';

export function loadCourse(course: Course): void {
  const map = getMap();
  const prev = drawStore.getState().points;

  // waypoints → Point[] 변환
  const points = course.waypoints.map((wp, i) => ({
    id: `course-${course.id}-${i}`,
    lng: wp[0],
    lat: wp[1],
  }));

  undoStack.push({
    t: 'loadCourse',
    prev,
    next: points,
  });

  drawStore.setPoints(points);
  routeStore.clear();

  // 편집 중인 코스 → 오버레이에서 제외
  setEditingCourse(course.id);

  // 미리 계산된 route가 있으면 세그먼트 캐시에 등록
  if (course.route) {
    prefillCache(course.route, points);
  }

  // 지도 이동
  map.flyTo({
    center: course.center,
    zoom: course.zoom,
    duration: 1200,
    essential: true,
  });

  // 그리기 모드로 전환
  drawStore.setMode('point');
}

function prefillCache(route: LineString, points: { lng: number; lat: number }[]): void {
  if (points.length < 2) return;

  const coords = route.coordinates as [number, number][];
  if (coords.length < 2) return;

  // 단일 세그먼트 캐시 (전체 경로)
  if (points.length === 2) {
    const from: LngLat = [points[0].lng, points[0].lat];
    const to: LngLat = [points[1].lng, points[1].lat];
    cacheSet(from, to, { line: route, meters: estimateMeters(route) });
    return;
  }

  // 다중 웨이포인트 — 각 세그먼트를 경로에서 분할 (단순 근사)
  for (let i = 0; i < points.length - 1; i++) {
    const from: LngLat = [points[i].lng, points[i].lat];
    const to: LngLat = [points[i + 1].lng, points[i + 1].lat];
    // 각 세그먼트를 직선으로 캐싱 (실제 경로 분할은 복잡 → 편집 시 재라우팅)
    const segLine: LineString = {
      type: 'LineString',
      coordinates: [from, to],
    };
    cacheSet(from, to, { line: segLine, meters: estimateMeters(segLine) });
  }
}

function estimateMeters(line: LineString): number {
  const coords = line.coordinates as [number, number][];
  let total = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = (coords[i + 1][0] - coords[i][0]) * Math.cos((coords[i][1] * Math.PI) / 180);
    const dy = coords[i + 1][1] - coords[i][1];
    total += Math.sqrt(dx * dx + dy * dy) * 111320;
  }
  return total;
}
