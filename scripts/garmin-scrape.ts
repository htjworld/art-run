/**
 * Garmin Connect GPX 다운로더
 * 실행: pnpm garmin-scrape <courseId> [courseId2] ...
 *   또는 인수 없이 실행 → 서울 인근 러닝 코스 전체 검색
 *
 * 준비:
 *   1. Git Bash에서 Chrome 디버깅 모드 실행:
 *      "/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug &
 *   2. 열린 Chrome에서 Garmin Connect 로그인
 *   3. pnpm garmin-scrape [courseId ...]
 */
import { chromium } from 'playwright';
import { writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';

const ARTRUN_DIR = join(process.cwd(), 'scripts', 'gpx', 'artrun');
const SCENIC_DIR = join(process.cwd(), 'scripts', 'gpx', 'scenic');

// 스니핑으로 확인된 실제 API base
const GC_API = 'https://connect.garmin.com/gc-api/course-service';

// 서울 bounding box (넓게)
const SEOUL_BOX = { north: 37.8, south: 37.2, east: 127.5, west: 126.5 };

interface GarminCourse {
  courseId: number;
  courseName?: string;
  name?: string;
  distance?: number;
  courseType?: string;
  startPoint?: { lat: number; lng: number };
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function toKebab(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .trim();
}

async function fetchJson(page: import('playwright').Page, url: string): Promise<unknown> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, url);
}

async function fetchText(page: import('playwright').Page, url: string): Promise<string> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
  }, url);
}

async function searchKoreaCourses(page: import('playwright').Page): Promise<GarminCourse[]> {
  // 서울 bounding box로 공개 러닝 코스 검색 (size=200 최대)
  const url = `${GC_API}/course/search?north=${SEOUL_BOX.north}&south=${SEOUL_BOX.south}&east=${SEOUL_BOX.east}&west=${SEOUL_BOX.west}&size=200&sort=CREATED_DATE_DESC`;
  const data = await fetchJson(page, url) as { results?: GarminCourse[]; courses?: GarminCourse[] } | GarminCourse[];
  if (Array.isArray(data)) return data;
  return (data as { results?: GarminCourse[]; courses?: GarminCourse[] }).results
    ?? (data as { results?: GarminCourse[]; courses?: GarminCourse[] }).courses
    ?? [];
}

async function getCourseGpx(page: import('playwright').Page, courseId: number): Promise<string> {
  return fetchText(page, `${GC_API}/course/${courseId}/gpx`);
}

async function getCourseMeta(page: import('playwright').Page, courseId: number): Promise<GarminCourse> {
  try {
    return await fetchJson(page, `${GC_API}/course/${courseId}`) as GarminCourse;
  } catch {
    return { courseId };
  }
}

async function saveCourse(
  page: import('playwright').Page,
  courseId: number,
  rawName: string,
  distKm: string,
): Promise<void> {
  const typeAnswer = await ask(`  분류 — (1) 인기코스 scenic  (2) 아트런 artrun  [기본: 1]: `);
  const dir = typeAnswer === '2' ? ARTRUN_DIR : SCENIC_DIR;

  const kebab = toKebab(rawName);
  const id = kebab || `garmin-${courseId}`;
  const gpxPath = join(dir, `${id}.gpx`);
  const jsonPath = join(dir, `${id}.json`);

  if (existsSync(gpxPath)) {
    const overwrite = await ask(`  ⚠️  ${id}.gpx 이미 존재합니다. 덮어쓰기? (y/N): `);
    if (overwrite.toLowerCase() !== 'y') { console.log(`  건너뜀\n`); return; }
  }

  const gpx = await getCourseGpx(page, courseId);
  writeFileSync(gpxPath, gpx, 'utf-8');

  if (!existsSync(jsonPath)) {
    writeFileSync(jsonPath, JSON.stringify({
      name: rawName,
      region: '한국',
      description: `${distKm}km 러닝 코스.`,
      thumbnail: '',
      zoom: 14,
    }, null, 2), 'utf-8');
  }
  console.log(`  ✅ ${id}.gpx 저장됨\n`);
}

async function connectChrome(): Promise<import('playwright').Page> {
  console.log('\n🔌 Chrome에 연결 중...');
  let browser: import('playwright').Browser | null = null;
  for (let i = 0; i < 15; i++) {
    try {
      browser = await chromium.connectOverCDP('http://localhost:9222');
      break;
    } catch {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!browser) {
    console.error('\n❌ Chrome 연결 실패.');
    console.error('  "/c/Program Files/Google/Chrome/Application/chrome.exe" --remote-debugging-port=9222 --user-data-dir=/tmp/chrome-debug &');
    process.exit(1);
  }
  console.log(' 연결됨!');
  const context = browser.contexts()[0] ?? await browser.newContext();
  return context.pages()[0] ?? await context.newPage();
}

async function main(): Promise<void> {
  const courseIds = process.argv.slice(2).map(Number).filter(n => !isNaN(n) && n > 0);
  const page = await connectChrome();

  if (!page.url().includes('connect.garmin.com')) {
    await page.goto('https://connect.garmin.com');
  }
  await ask('\n✅ Garmin Connect 로그인 완료 후 Enter를 누르세요...');

  // ── 모드 A: 특정 ID 지정 ───────────────────────────────────────────
  if (courseIds.length > 0) {
    console.log(`\n📥 ${courseIds.length}개 코스 다운로드\n`);
    for (const courseId of courseIds) {
      console.log(`─── courseId: ${courseId}`);
      const meta = await getCourseMeta(page, courseId);
      const rawName = meta.courseName ?? meta.name ?? `garmin-${courseId}`;
      const distKm = meta.distance ? (meta.distance / 1000).toFixed(1) : '?';
      console.log(`  이름: ${rawName}  (${distKm}km)`);
      try {
        await saveCourse(page, courseId, rawName, distKm);
      } catch (e) {
        console.error(`  ❌ 실패:`, (e as Error).message, '\n');
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // ── 모드 B: 서울 인근 전체 검색 ───────────────────────────────────
  else {
    console.log('\n🔍 서울 인근 공개 러닝 코스 검색 중...');
    let courses: GarminCourse[] = [];
    try {
      courses = await searchKoreaCourses(page);
    } catch (e) {
      console.error('검색 실패:', (e as Error).message);
      process.exit(1);
    }

    // 러닝 타입 필터
    const running = courses.filter(c => {
      const t = (c.courseType ?? '').toUpperCase();
      return !t || t.includes('RUNNING') || t.includes('TRAIL');
    });

    console.log(`\n🇰🇷 러닝 코스 ${running.length}개 발견\n`);
    running.forEach((c, i) => {
      const dist = c.distance ? `${(c.distance / 1000).toFixed(1)}km` : '?km';
      const name = c.courseName ?? c.name ?? `garmin-${c.courseId}`;
      console.log(`  [${String(i + 1).padStart(3)}] ${name}  (${dist})`);
    });

    console.log('\n저장할 번호를 입력하세요. (예: 1,3,5  또는  all)');
    const sel = await ask('> ');

    const selected = sel.toLowerCase() === 'all'
      ? running
      : sel.split(',').map(s => running[parseInt(s.trim(), 10) - 1]).filter(Boolean);

    console.log(`\n📥 ${selected.length}개 다운로드 시작\n`);
    for (const course of selected) {
      const rawName = course.courseName ?? course.name ?? `garmin-${course.courseId}`;
      const distKm = course.distance ? (course.distance / 1000).toFixed(1) : '?';
      console.log(`─── ${rawName} (${distKm}km)`);
      try {
        await saveCourse(page, course.courseId, rawName, distKm);
      } catch (e) {
        console.error(`  ❌ 실패:`, (e as Error).message, '\n');
      }
      await new Promise(r => setTimeout(r, 300));
    }
  }

  console.log('🎉 완료! pnpm precompute 로 courses.json 갱신하세요.\n');
}

main().catch(err => { console.error(err); process.exit(1); });
