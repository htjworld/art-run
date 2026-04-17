/**
 * 갤러리 코스 프리컴퓨트 스크립트
 * 실행: pnpm precompute
 * 필요 환경변수: VITE_ORS_KEY
 *
 * courses.json의 각 코스의 waypoints를 ORS로 라우팅하여
 * route, routeSimplified 필드를 채운다.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { LineString } from 'geojson';

const ORS_KEY = process.env.VITE_ORS_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
const SIMPLIFY_TOLERANCE = 0.00005; // ~5m

interface RawCourse {
  id: string;
  type: string;
  name: string;
  distanceKm: number;
  region: string;
  description: string;
  thumbnail: string;
  center: [number, number];
  zoom: number;
  waypoints: [number, number][];
  route: LineString | null;
  routeSimplified: LineString | null;
}

async function routeSegment(from: [number, number], to: [number, number]): Promise<LineString> {
  if (!ORS_KEY) throw new Error('VITE_ORS_KEY 환경변수가 없습니다.');

  const res = await fetch(ORS_URL, {
    method: 'POST',
    headers: { Authorization: ORS_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ coordinates: [from, to] }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`ORS 오류 ${res.status}: ${text}`);
  }

  const json = await res.json() as { features: Array<{ geometry: LineString }> };
  return json.features[0].geometry;
}

function mergeLines(lines: LineString[]): LineString {
  const coords: [number, number][] = [];
  for (let i = 0; i < lines.length; i++) {
    const lc = lines[i].coordinates as [number, number][];
    if (i === 0) coords.push(...lc);
    else coords.push(...lc.slice(1));
  }
  return { type: 'LineString', coordinates: coords };
}

function simplifyLine(line: LineString, tolerance: number): LineString {
  const coords = line.coordinates as [number, number][];
  if (coords.length <= 2) return line;

  function perpendicularDist(p: [number, number], a: [number, number], b: [number, number]): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0) {
      return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
    }
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    const tc = Math.max(0, Math.min(1, t));
    return Math.sqrt((p[0] - (a[0] + tc * dx)) ** 2 + (p[1] - (a[1] + tc * dy)) ** 2);
  }

  function douglasPeucker(pts: [number, number][], eps: number): [number, number][] {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let maxIdx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perpendicularDist(pts[i], pts[0], pts[pts.length - 1]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > eps) {
      const left = douglasPeucker(pts.slice(0, maxIdx + 1), eps);
      const right = douglasPeucker(pts.slice(maxIdx), eps);
      return [...left.slice(0, -1), ...right];
    }
    return [pts[0], pts[pts.length - 1]];
  }

  return { type: 'LineString', coordinates: douglasPeucker(coords, tolerance) };
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

async function main(): Promise<void> {
  if (!ORS_KEY) {
    console.error('❌ VITE_ORS_KEY가 설정되지 않았습니다. .env.local을 확인하세요.');
    process.exit(1);
  }

  const coursesPath = join(process.cwd(), 'src', 'gallery', 'courses.json');
  const courses = JSON.parse(readFileSync(coursesPath, 'utf-8')) as RawCourse[];

  console.log(`📍 코스 ${courses.length}개 프리컴퓨트 시작`);

  for (const course of courses) {
    if (course.waypoints.length < 2) {
      console.log(`⏭ ${course.name}: waypoints 부족, 건너뜀`);
      continue;
    }

    console.log(`🔄 ${course.name} (${course.waypoints.length}개 waypoint)...`);

    try {
      const segments: LineString[] = [];
      for (let i = 0; i < course.waypoints.length - 1; i++) {
        const seg = await routeSegment(course.waypoints[i], course.waypoints[i + 1]);
        segments.push(seg);
        await sleep(1500); // 40 req/min 제한 → 1.5초 간격
      }

      const merged = mergeLines(segments);
      const simplified = simplifyLine(merged, SIMPLIFY_TOLERANCE);

      course.route = merged;
      course.routeSimplified = simplified;

      // 실제 거리 계산
      const coords = merged.coordinates as [number, number][];
      let totalM = 0;
      for (let i = 0; i < coords.length - 1; i++) {
        const dx = (coords[i + 1][0] - coords[i][0]) * Math.cos((coords[i][1] * Math.PI) / 180);
        const dy = coords[i + 1][1] - coords[i][1];
        totalM += Math.sqrt(dx * dx + dy * dy) * 111320;
      }
      course.distanceKm = Math.round(totalM / 100) / 10;

      console.log(`  ✅ ${course.name}: ${course.distanceKm}km, ${merged.coordinates.length}pts → ${simplified.coordinates.length}pts (simplified)`);
    } catch (err) {
      console.error(`  ❌ ${course.name} 실패:`, (err as Error).message);
    }
  }

  writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf-8');
  console.log(`\n✅ courses.json 업데이트 완료`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
