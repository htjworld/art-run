/**
 * 갤러리 코스 프리컴퓨트 스크립트
 * 실행: pnpm precompute
 *
 * 우선순위:
 *   1. scripts/gpx/{id}.gpx 파일이 있으면 → GPX에서 직접 로드 (ORS 호출 없음)
 *   2. GPX 없으면 → waypoints → ORS 보행 경로 계산
 *
 * GPX 추가/교체 방법:
 *   scripts/gpx/{course-id}.gpx 파일을 넣고 pnpm precompute 실행
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LineString } from 'geojson';

// .env.local 자동 로드
const envPath = join(process.cwd(), '.env.local');
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([^#][^=]*)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
  }
}

const ORS_KEY = process.env.VITE_ORS_KEY;
const ORS_URL = 'https://api.openrouteservice.org/v2/directions/foot-walking/geojson';
const SIMPLIFY_TOLERANCE = 0.00005; // ~5m
const GPX_DIR = join(process.cwd(), 'scripts', 'gpx');

interface RawCourse {
  id: string;
  name: string;
  distanceKm: number;
  waypoints: [number, number][];
  route: LineString | null;
  routeSimplified: LineString | null;
}

// ─── GPX 파싱 ────────────────────────────────────────────────────────────────
function parseGpx(content: string): LineString {
  const coords: [number, number][] = [];
  const regex = /<trkpt\s+lat="([^"]+)"\s+lon="([^"]+)"/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(content)) !== null) {
    coords.push([parseFloat(m[2]), parseFloat(m[1])]); // GeoJSON: [lng, lat]
  }
  if (coords.length < 2) throw new Error('trkpt 좌표가 2개 미만입니다');
  return { type: 'LineString', coordinates: coords };
}

// ─── ORS 라우팅 ──────────────────────────────────────────────────────────────
async function routeSegment(
  from: [number, number],
  to: [number, number],
): Promise<LineString> {
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

  const json = (await res.json()) as { features: Array<{ geometry: LineString }> };
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

// ─── Douglas-Peucker 단순화 ──────────────────────────────────────────────────
function simplifyLine(line: LineString, tolerance: number): LineString {
  const coords = line.coordinates as [number, number][];
  if (coords.length <= 2) return line;

  function perp(p: [number, number], a: [number, number], b: [number, number]): number {
    const dx = b[0] - a[0];
    const dy = b[1] - a[1];
    if (dx === 0 && dy === 0)
      return Math.sqrt((p[0] - a[0]) ** 2 + (p[1] - a[1]) ** 2);
    const t = ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy);
    const tc = Math.max(0, Math.min(1, t));
    return Math.sqrt((p[0] - (a[0] + tc * dx)) ** 2 + (p[1] - (a[1] + tc * dy)) ** 2);
  }

  function dp(pts: [number, number][], eps: number): [number, number][] {
    if (pts.length <= 2) return pts;
    let maxDist = 0;
    let maxIdx = 0;
    for (let i = 1; i < pts.length - 1; i++) {
      const d = perp(pts[i], pts[0], pts[pts.length - 1]);
      if (d > maxDist) { maxDist = d; maxIdx = i; }
    }
    if (maxDist > eps) {
      return [
        ...dp(pts.slice(0, maxIdx + 1), eps).slice(0, -1),
        ...dp(pts.slice(maxIdx), eps),
      ];
    }
    return [pts[0], pts[pts.length - 1]];
  }

  return { type: 'LineString', coordinates: dp(coords, tolerance) };
}

function calcDistanceKm(line: LineString): number {
  const coords = line.coordinates as [number, number][];
  let totalM = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx =
      (coords[i + 1][0] - coords[i][0]) *
      Math.cos((coords[i][1] * Math.PI) / 180);
    const dy = coords[i + 1][1] - coords[i][1];
    totalM += Math.sqrt(dx * dx + dy * dy) * 111320;
  }
  return Math.round(totalM / 100) / 10;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const coursesPath = join(process.cwd(), 'src', 'gallery', 'courses.json');
  const courses = JSON.parse(readFileSync(coursesPath, 'utf-8')) as RawCourse[];

  console.log(`📍 코스 ${courses.length}개 프리컴퓨트 시작\n`);

  for (const course of courses) {
    const gpxPath = join(GPX_DIR, `${course.id}.gpx`);

    if (existsSync(gpxPath)) {
      // ── 1순위: GPX 파일 직접 로드 ──
      console.log(`📂 ${course.name} — GPX 로드 (${course.id}.gpx)`);
      try {
        const content = readFileSync(gpxPath, 'utf-8');
        const route = parseGpx(content);
        course.route = route;
        course.routeSimplified = simplifyLine(route, SIMPLIFY_TOLERANCE);
        course.distanceKm = calcDistanceKm(route);
        console.log(
          `   ✅ ${course.distanceKm}km · ${route.coordinates.length}pts → ${course.routeSimplified.coordinates.length}pts`,
        );
      } catch (err) {
        console.error(`   ❌ GPX 파싱 실패:`, (err as Error).message);
      }
      continue;
    }

    // ── 2순위: waypoints → ORS 라우팅 ──
    if (course.waypoints.length < 2) {
      console.log(`⏭  ${course.name}: waypoints 부족 — 건너뜀`);
      continue;
    }
    if (!ORS_KEY) {
      console.warn(`⚠️  ${course.name}: GPX 없고 ORS 키도 없음 — 건너뜀`);
      continue;
    }

    console.log(`🔄 ${course.name} — ORS 라우팅 (waypoints ${course.waypoints.length}개)`);
    try {
      const segments: LineString[] = [];
      for (let i = 0; i < course.waypoints.length - 1; i++) {
        const seg = await routeSegment(course.waypoints[i], course.waypoints[i + 1]);
        segments.push(seg);
        await sleep(1500); // 40 req/min 제한
      }
      const merged = mergeLines(segments);
      course.route = merged;
      course.routeSimplified = simplifyLine(merged, SIMPLIFY_TOLERANCE);
      course.distanceKm = calcDistanceKm(merged);
      console.log(
        `   ✅ ${course.distanceKm}km · ${merged.coordinates.length}pts → ${course.routeSimplified.coordinates.length}pts`,
      );
    } catch (err) {
      console.error(`   ❌ ${course.name} 실패:`, (err as Error).message);
    }
  }

  writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf-8');
  console.log(`\n✅ courses.json 업데이트 완료`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
