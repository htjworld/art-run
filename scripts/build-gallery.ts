/**
 * 갤러리 코스 프리컴퓨트 스크립트
 * 실행: pnpm precompute
 *
 * 구조:
 *   scripts/gpx/artrun/{id}.gpx + {id}.json  → 인기 아트런
 *   scripts/gpx/scenic/{id}.gpx  + {id}.json → 인기 코스
 *
 * 코스 추가 방법:
 *   1. scripts/gpx/artrun/ 또는 scenic/ 에 {id}.gpx 추가
 *   2. 같은 폴더에 {id}.json (메타 정보) 추가
 *   3. pnpm precompute 실행 → courses.json 자동 갱신
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import type { LineString } from 'geojson';

const SIMPLIFY_TOLERANCE = 0.00005; // ~5m
const GPX_DIR = join(process.cwd(), 'scripts', 'gpx');

interface CourseMeta {
  name: string;
  region: string;
  description: string;
  thumbnail?: string;
  center?: [number, number];
  zoom?: number;
}

interface Course {
  id: string;
  type: 'artrun' | 'scenic';
  name: string;
  distanceKm: number;
  region: string;
  description: string;
  thumbnail: string;
  center: [number, number];
  zoom: number;
  route: LineString;
  routeSimplified: LineString;
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

function calcCenter(line: LineString): [number, number] {
  const coords = line.coordinates as [number, number][];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  return [
    Math.round(((Math.min(...lngs) + Math.max(...lngs)) / 2) * 10000) / 10000,
    Math.round(((Math.min(...lats) + Math.max(...lats)) / 2) * 10000) / 10000,
  ];
}

function calcZoom(line: LineString): number {
  const coords = line.coordinates as [number, number][];
  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const span = Math.max(
    Math.max(...lngs) - Math.min(...lngs),
    Math.max(...lats) - Math.min(...lats),
  );
  if (span < 0.01) return 15;
  if (span < 0.03) return 14;
  if (span < 0.06) return 13;
  if (span < 0.1) return 12;
  return 11;
}

// ─── 메인 ────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  const courses: Course[] = [];

  for (const type of ['artrun', 'scenic'] as const) {
    const dir = join(GPX_DIR, type);
    const gpxFiles = readdirSync(dir)
      .filter(f => f.endsWith('.gpx'))
      .sort();

    for (const gpxFile of gpxFiles) {
      const id = gpxFile.replace('.gpx', '');
      const gpxPath = join(dir, gpxFile);
      const metaPath = join(dir, `${id}.json`);

      if (!existsSync(metaPath)) {
        console.warn(`⚠️  [${type}] ${id}: ${id}.json 없음 — 건너뜀`);
        continue;
      }

      let meta: CourseMeta;
      try {
        meta = JSON.parse(readFileSync(metaPath, 'utf-8')) as CourseMeta;
      } catch (err) {
        console.error(`❌ [${type}] ${id}: JSON 파싱 실패 —`, (err as Error).message);
        continue;
      }

      try {
        const content = readFileSync(gpxPath, 'utf-8');
        const route = parseGpx(content);
        const routeSimplified = simplifyLine(route, SIMPLIFY_TOLERANCE);
        const distanceKm = calcDistanceKm(route);
        const center = meta.center ?? calcCenter(route);
        const zoom = meta.zoom ?? calcZoom(route);

        courses.push({
          id,
          type,
          name: meta.name,
          distanceKm,
          region: meta.region,
          description: meta.description,
          thumbnail: meta.thumbnail ?? '',
          center,
          zoom,
          route,
          routeSimplified,
        });

        console.log(
          `✅ [${type}] ${meta.name} — ${distanceKm}km · ${route.coordinates.length}pts → ${routeSimplified.coordinates.length}pts`,
        );
      } catch (err) {
        console.error(`❌ [${type}] ${id} GPX 파싱 실패:`, (err as Error).message);
      }
    }
  }

  const coursesPath = join(process.cwd(), 'src', 'gallery', 'courses.json');
  writeFileSync(coursesPath, JSON.stringify(courses, null, 2), 'utf-8');
  console.log(`\n✅ courses.json ${courses.length}개 코스 생성 완료`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
