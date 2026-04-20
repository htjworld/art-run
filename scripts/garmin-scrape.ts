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

// 네트워크 트래픽 스니핑 — 실제 API 호출 URL 로그
async function sniffApiCalls(page: import('playwright').Page, durationMs: number): Promise<string[]> {
  const found: string[] = [];
  const handler = (response: import('playwright').Response) => {
    const url = response.url();
    if (url.includes('connect.garmin.com') && url.includes('course') && response.status() === 200) {
      found.push(url);
    }
  };
  page.on('response', handler);
  await new Promise(r => setTimeout(r, durationMs));
  page.off('response', handler);
  return found;
}

async function fetchCoursesByUrl(page: import('playwright').Page, url: string): Promise<GarminCourse[]> {
  return page.evaluate(async (url) => {
    const res = await fetch(url, { credentials: 'include' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return Array.isArray(data) ? data : (data.courses ?? data.items ?? data.results ?? []);
  }, url);
}

async function searchNearby(page: import('playwright').Page, apiBase: string): Promise<GarminCourse[]> {
  // 서울 중심 좌표로 반경 200km 내 러닝 코스 검색
  const candidates = [
    `${apiBase}/course/search/nearby?lat=37.5665&lng=126.9780&distance=200&unit=km&courseType=RUNNING&start=0&limit=100`,
    `${apiBase}/course/search?lat=37.5665&lng=126.9780&distance=200000&courseType=RUNNING&start=0&limit=100`,
    `${apiBase}/course?lat=37.5665&lng=126.9780&distance=200000&courseType=running&start=0&limit=100`,
    `${apiBase}/course/search/nearby?lat=37.5665&lng=126.9780&distance=200000&courseType=running&sortField=POPULARITY&sortOrder=DESC&start=0&limit=100`,
  ];
  for (const url of candidates) {
    try {
      const result = await fetchCoursesByUrl(page, url);
      if (result.length > 0) { console.log(`  성공: ${url}`); return result; }
    } catch { /* 다음 시도 */ }
  }
  return [];
}

async function downloadGpx(page: import('playwright').Page, apiBase: string, courseId: number): Promise<string> {
  return page.evaluate(async ({ apiBase, courseId }) => {
    const res = await fetch(`${apiBase}/course/${courseId}/gpx`, { credentials: 'include' });
    if (!res.ok) throw new Error(`GPX 다운로드 실패: HTTP ${res.status}`);
    return res.text();
  }, { apiBase, courseId });
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

  // 이미 로그인돼 있으면 바로 courses 페이지로
  if (!page.url().includes('connect.garmin.com')) {
    await page.goto('https://connect.garmin.com/modern/courses');
  }

  await ask('\n✅ 브라우저에서 Garmin Connect 로그인 완료 후 Enter를 누르세요...');

  // Courses 페이지로 이동하면서 네트워크 스니핑
  console.log('\n🔍 Courses 페이지 로딩 + API 호출 스니핑 중... (5초)');
  const sniffPromise = sniffApiCalls(page, 5000);
  await page.goto('https://connect.garmin.com/modern/courses');
  const sniffed = await sniffPromise;

  console.log('\n감지된 course API 호출:');
  sniffed.forEach(u => console.log('  ', u));

  // apiBase 결정
  let apiBase = 'https://connect.garmin.com/proxy/course-service';
  for (const u of sniffed) {
    const m = u.match(/(https:\/\/connect\.garmin\.com\/(?:proxy\/)?[^/]+-service)/);
    if (m) { apiBase = m[1]; break; }
  }
  console.log(`\napiBase: ${apiBase}`);

  console.log('\n📡 서울 인근 러닝 코스 검색 중...');
  const allCourses = await searchNearby(page, apiBase);

  if (allCourses.length === 0) {
    console.log('\n⚠️  자동 검색 실패. 위의 스니핑된 URL을 확인하세요.');
    console.log('감지된 URL이 있으면 개발자에게 공유해주세요.');
    await ask('Enter를 누르면 종료합니다...');
    await context.close();
    return;
  }

  console.log(`\n총 ${allCourses.length}개 수집됨. 한국 코스 필터링 중...`);

  // nearby 검색은 이미 한국 좌표로 필터링됐으므로 그대로 사용
  // startPoint가 있는 경우 한국 여부 재확인, 없으면 포함
  const koreaCourses: GarminCourse[] = allCourses.filter(course => {
    const sp = course.startPoint;
    if (!sp) return true; // 좌표 없으면 포함 (nearby 검색 결과라 이미 한국)
    return isInKorea(sp.lat, sp.lng);
  });

  koreaCourses.forEach(c => {
    const dist = c.distance ? `${(c.distance / 1000).toFixed(1)}km` : '?km';
    console.log(`  🇰🇷 ${c.courseName} (${dist})`);
  });

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

  const selected: GarminCourse[] = selection.toLowerCase() === 'all'
    ? koreaCourses
    : selection.split(',')
        .map(s => parseInt(s.trim(), 10) - 1)
        .filter(i => i >= 0 && i < koreaCourses.length)
        .map(i => koreaCourses[i]);

  console.log(`\n📥 ${selected.length}개 코스 GPX 다운로드 시작...\n`);

  for (const course of selected) {
    const typeAnswer = await ask(`[${course.courseName}] 분류 — (1) 인기코스 scenic  (2) 아트런 artrun  [기본: 1]: `);
    const courseType = typeAnswer === '2' ? 'artrun' : 'scenic';
    const dir = courseType === 'artrun' ? ARTRUN_DIR : SCENIC_DIR;

    const safeName = toKebab(course.courseName);
    const id = safeName || `garmin-${course.courseId}`;
    const gpxPath = join(dir, `${id}.gpx`);
    const jsonPath = join(dir, `${id}.json`);

    if (existsSync(gpxPath)) {
      const overwrite = await ask(`  ⚠️  ${id}.gpx 이미 존재합니다. 덮어쓰기? (y/N): `);
      if (overwrite.toLowerCase() !== 'y') { console.log(`  건너뜀: ${id}`); continue; }
    }

    try {
      const gpxContent = await downloadGpx(page, apiBase, course.courseId);
      writeFileSync(gpxPath, gpxContent, 'utf-8');

      if (!existsSync(jsonPath)) {
        const distKm = (course.distance / 1000).toFixed(1);
        writeFileSync(jsonPath, JSON.stringify({
          name: course.courseName,
          region: '한국',
          description: `${distKm}km 러닝 코스.`,
          thumbnail: '',
          center: course.startPoint ? [course.startPoint.lng, course.startPoint.lat] : undefined,
          zoom: 14,
        }, null, 2), 'utf-8');
        console.log(`  ✅ ${id}.gpx + .json 저장됨`);
      } else {
        console.log(`  ✅ ${id}.gpx 저장됨`);
      }
    } catch (e) {
      console.error(`  ❌ ${course.courseName} 실패:`, (e as Error).message);
    }

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('\n🎉 완료! pnpm precompute 로 courses.json을 갱신하세요.');
  console.log('⚠️  .json 파일의 name, region, description을 한국어로 수정해주세요.\n');

  await context.close();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
