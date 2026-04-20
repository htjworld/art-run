/**
 * courses.json의 route 데이터를 scripts/gpx/{id}.gpx 파일로 추출
 * 실행: pnpm export-routes
 *
 * 이미 GPX 파일이 존재하면 덮어쓰지 않음 (검증된 파일 보호)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { LineString } from 'geojson';

const GPX_DIR = join(process.cwd(), 'scripts', 'gpx');

interface RawCourse {
  id: string;
  name: string;
  route: LineString | null;
}

function toGpx(name: string, line: LineString): string {
  const trkpts = (line.coordinates as [number, number][])
    .map(([lng, lat]) => `      <trkpt lat="${lat}" lon="${lng}"/>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="ArtRun" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><name>${name}</name></metadata>
  <trk>
    <name>${name}</name>
    <trkseg>
${trkpts}
    </trkseg>
  </trk>
</gpx>`;
}

function main(): void {
  mkdirSync(GPX_DIR, { recursive: true });

  const coursesPath = join(process.cwd(), 'src', 'gallery', 'courses.json');
  const courses = JSON.parse(readFileSync(coursesPath, 'utf-8')) as RawCourse[];

  for (const course of courses) {
    const gpxPath = join(GPX_DIR, `${course.id}.gpx`);

    if (existsSync(gpxPath)) {
      console.log(`⏭  ${course.id}.gpx 이미 존재 — 건너뜀 (덮어쓰기 방지)`);
      continue;
    }

    if (!course.route) {
      console.log(`⚠️  ${course.id}: route 없음 — 건너뜀`);
      continue;
    }

    writeFileSync(gpxPath, toGpx(course.name, course.route), 'utf-8');
    console.log(`✅ ${course.id}.gpx 생성 (${course.route.coordinates.length}pts)`);
  }

  console.log('\n완료. scripts/gpx/ 폴더를 확인하세요.');
}

main();
