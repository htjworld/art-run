/**
 * Garmin Connect 코스 스크래퍼
 * 실행: pnpm garmin-scrape
 *
 * 1. 브라우저 창이 열리면 Garmin Connect에 로그인
 * 2. 로그인 완료 후 터미널에서 Enter
 * 3. 한국 러닝 코스 자동 수집 → scripts/gpx/scenic/ 또는 artrun/ 에 저장
 */
import { chromium } from 'playwright';
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import * as readline from 'node:readline';

// 한국 bounding box
const KOREA_BOUNDS = { minLng: 124.6, maxLng: 131.9, minLat: 33.1, maxLat: 38.7 };

const ARTRUN_DIR = join(process.cwd(), 'scripts', 'gpx', 'artrun');
const SCENIC_DIR = join(process.cwd(), 'scripts', 'gpx', 'scenic');

interface GarminCourse {
  courseId: number;
  courseName: string;
  distance: number; // meters
  courseType: string;
  startPoint?: { lat: number; lng: number };
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(question, ans => { rl.close(); resolve(ans.trim()); }));
}

function toKebab(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function isInKorea(lat: number, lng: number): boolean {
  return (
    lng >= KOREA_BOUNDS.minLng && lng <= KOREA_BOUNDS.maxLng &&
    lat >= KOREA_BOUNDS.minLat && lat <= KOREA_BOUNDS.maxLat
  );
}

async function fetchCourses(page: import('playwright').Page, start = 0, limit = 100): Promise<GarminCourse[]> {
  return page.evaluate(async ({ start, limit }) => {
    const url = `/course-service/course?start=${start}&limit=${limit}&courseType=running&sortField=POPULARITY&sortOrder=DESC`;
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, { start, limit });
}

async function fetchCourseDetail(page: import('playwright').Page, courseId: number): Promise<{ startPoint?: { lat: number; lng: number } }> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/course-service/course/${id}`, { credentials: 'include' });
    if (!res.ok) return {};
    return res.json();
  }, courseId);
}

async function downloadGpx(page: import('playwright').Page, courseId: number): Promise<string> {
  return page.evaluate(async (id) => {
    const res = await fetch(`/course-service/course/${id}/gpx`, { credentials: 'include' });
    if (!res.ok) throw new Error(`GPX 다운로드 실패: HTTP ${res.status}`);
    return res.text();
  }, courseId);
}

async function main(): Promise<void> {
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('  Garmin Connect 스크래퍼');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('준비 방법:');
  console.log('  1. 터미널을 새로 열어 아래 명령어로 Chrome을 실행하세요:');
  console.log('');
  console.log('     "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222 --user-data-dir=C:\\Temp\\chrome-debug');
  console.log('');
  console.log('  2. 열린 Chrome에서 https://connect.garmin.com 로그인');
  console.log('  3. 로그인 완료 후 아래에서 Enter');
  console.log('');

  await ask('Chrome 로그인 완료 후 Enter를 누르세요...');

  console.log('\n🔌 Chrome에 연결 중... (최대 30초 대기)');

  let context: import('playwright').BrowserContext | null = null;
  for (let i = 0; i < 15; i++) {
    try {
      const browser = await chromium.connectOverCDP('http://localhost:9222');
      context = browser.contexts()[0] ?? await browser.newContext();
      break;
    } catch {
      process.stdout.write('.');
      await new Promise(r => setTimeout(r, 2000));
    }
  }
  if (!context) {
    console.error('\n❌ Chrome 원격 디버깅 연결 실패.');
    console.error('   포트 확인: curl http://localhost:9222/json');
    process.exit(1);
  }
  console.log(' 연결됨!');

  const page = context.pages()[0] ?? await context.newPage();

  console.log('\n🌐 Garmin Connect 로그인 페이지를 엽니다...');
  await page.goto('https://connect.garmin.com/signin');

  await ask('\n✅ 브라우저에서 Garmin Connect 로그인 완료 후 Enter를 누르세요...');

  // 로그인 확인
  const currentUrl = page.url();
  if (currentUrl.includes('signin')) {
    await page.goto('https://connect.garmin.com/modern/courses');
    await page.waitForTimeout(2000);
  }

  console.log('\n📡 코스 목록 가져오는 중...');

  let allCourses: GarminCourse[] = [];
  try {
    // 최대 500개 시도
    for (let start = 0; start < 500; start += 100) {
      const batch = await fetchCourses(page, start, 100);
      if (!Array.isArray(batch) || batch.length === 0) break;
      allCourses.push(...batch);
      console.log(`  ${allCourses.length}개 수집 중...`);
      if (batch.length < 100) break;
    }
  } catch (e) {
    console.error('코스 목록 API 오류:', e);
    console.log('수동으로 courses 페이지로 이동 중...');
    await page.goto('https://connect.garmin.com/modern/courses');
    await page.waitForTimeout(3000);
    // 재시도
    try {
      allCourses = await fetchCourses(page, 0, 100);
    } catch {
      console.error('재시도도 실패. 로그인 상태를 확인해주세요.');
      await context.close();
      return;
    }
  }

  console.log(`\n총 ${allCourses.length}개 코스 수집됨. 한국 코스 필터링 중...`);

  // 한국 코스 필터링 — startPoint 좌표 확인
  const koreaCourses: GarminCourse[] = [];
  for (const course of allCourses) {
    try {
      const detail = await fetchCourseDetail(page, course.courseId);
      const sp = detail.startPoint;
      if (sp && isInKorea(sp.lat, sp.lng)) {
        course.startPoint = sp;
        koreaCourses.push(course);
        console.log(`  🇰🇷 ${course.courseName} (${(course.distance / 1000).toFixed(1)}km)`);
      }
    } catch { /* 개별 실패는 건너뜀 */ }
    await page.waitForTimeout(200); // rate limit 방지
  }

  if (koreaCourses.length === 0) {
    console.log('\n한국 코스를 찾지 못했습니다. 브라우저에서 직접 확인해보세요.');
    await ask('Enter를 누르면 종료합니다...');
    await context.close();
    return;
  }

  console.log(`\n🇰🇷 한국 러닝 코스 ${koreaCourses.length}개 발견!\n`);
  koreaCourses.forEach((c, i) => {
    console.log(`  [${String(i + 1).padStart(2)}] ${c.courseName}  (${(c.distance / 1000).toFixed(1)}km)`);
  });

  console.log('\n저장할 코스 번호를 입력하세요.');
  console.log('  예) 1,3,5  또는  all (전체)');
  const selection = await ask('> ');

  let selected: GarminCourse[] = [];
  if (selection.toLowerCase() === 'all') {
    selected = koreaCourses;
  } else {
    const indices = selection.split(',').map(s => parseInt(s.trim(), 10) - 1).filter(i => i >= 0 && i < koreaCourses.length);
    selected = indices.map(i => koreaCourses[i]);
  }

  console.log(`\n📥 ${selected.length}개 코스 GPX 다운로드 시작...\n`);

  for (const course of selected) {
    const typeAnswer = await ask(`[${course.courseName}] 분류 — (1) 인기코스 scenic  (2) 아트런 artrun  [기본: 1]: `);
    const courseType = typeAnswer === '2' ? 'artrun' : 'scenic';
    const dir = courseType === 'artrun' ? ARTRUN_DIR : SCENIC_DIR;

    // ID 생성 (영문 변환이 어려우므로 garmin- 접두사 + courseId 사용)
    const safeName = toKebab(course.courseName);
    const id = safeName || `garmin-${course.courseId}`;

    const gpxPath = join(dir, `${id}.gpx`);
    const jsonPath = join(dir, `${id}.json`);

    if (existsSync(gpxPath)) {
      const overwrite = await ask(`  ⚠️  ${id}.gpx 이미 존재합니다. 덮어쓰기? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') {
        console.log(`  건너뜀: ${id}`);
        continue;
      }
    }

    try {
      const gpxContent = await downloadGpx(page, course.courseId);
      writeFileSync(gpxPath, gpxContent, 'utf-8');

      // 사이드카 JSON (메타 기본값)
      if (!existsSync(jsonPath)) {
        const distKm = (course.distance / 1000).toFixed(1);
        const meta = {
          name: course.courseName,
          region: '한국',
          description: `${distKm}km 러닝 코스.`,
          thumbnail: '',
          center: course.startPoint ? [course.startPoint.lng, course.startPoint.lat] : undefined,
          zoom: 14,
        };
        writeFileSync(jsonPath, JSON.stringify(meta, null, 2), 'utf-8');
        console.log(`  ✅ ${id}.gpx + .json 저장됨`);
      } else {
        console.log(`  ✅ ${id}.gpx 저장됨 (JSON은 이미 존재)`);
      }
    } catch (e) {
      console.error(`  ❌ ${course.courseName} 실패:`, (e as Error).message);
    }

    await page.waitForTimeout(500);
  }

  console.log('\n🎉 완료! 이제 pnpm precompute 를 실행해 courses.json을 갱신하세요.\n');
  console.log('⚠️  저장된 .json 파일의 name, region, description을 한국어로 수정해주세요.');

  await context.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
