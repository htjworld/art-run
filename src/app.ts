import './ui/styles.css';
import { initMap, updateRouteSource, updatePendingSource, updateErrorSource, updatePointsSource, resizeMap } from './map/mapView';
import { initInteractions } from './map/interactions';
import { loadOverlay } from './map/overlay';
import { initRouteAnimator } from './map/routeAnimator';
import { initPointMode } from './draw/pointMode';
import { initDragMode } from './draw/dragMode';
import { drawStore } from './draw/drawStore';
import { routeStore, getComposedLine, getPendingLines, getErrorLines } from './draw/routeComposer';
import { setRoutingProvider } from './draw/routeComposer';
import { OrsClient } from './routing/orsClient';
import { createToolbar } from './ui/toolbar';
import { createModeToggle } from './ui/modeToggle';
import { initGallery } from './gallery/galleryView';
import { createLocationSearch } from './ui/locationSearch';
import { createCourseChips } from './ui/courseChips';
import { showToast } from './ui/toast';
import coursesData from './gallery/courses.json';
import type { Course } from './gallery/courses';

export async function initApp(rootEl: HTMLElement): Promise<void> {
  // ORS 프로바이더 등록
  const orsKey = import.meta.env.VITE_ORS_KEY as string | undefined;
  if (orsKey) {
    setRoutingProvider(new OrsClient(orsKey));
  } else {
    showToast('ORS API 키가 없습니다. .env.local에 VITE_ORS_KEY를 설정하면 경로를 계산할 수 있어요.', 'info', 6000);
  }

  // 앱 구조 빌드
  rootEl.innerHTML = '';

  // 타이틀바 (모바일)
  const titlebar = document.createElement('div');
  titlebar.className = 'titlebar';
  titlebar.innerHTML = `<span class="titlebar__wordmark">ArtRun</span>`;
  rootEl.appendChild(titlebar);

  // 레이아웃
  const layout = document.createElement('div');
  layout.className = 'layout';
  rootEl.appendChild(layout);

  // 사이드바 (데스크톱)
  const sidebar = document.createElement('div');
  sidebar.className = 'sidebar';
  const sidebarHeader = document.createElement('div');
  sidebarHeader.className = 'sidebar__header';
  sidebarHeader.innerHTML = `<span class="sidebar__wordmark">ArtRun</span>`;
  const sidebarTop = document.createElement('div');
  sidebarTop.className = 'sidebar__top';
  const sidebarContent = document.createElement('div');
  sidebarContent.className = 'sidebar__content';
  sidebar.appendChild(sidebarHeader);
  sidebar.appendChild(sidebarTop);
  sidebar.appendChild(sidebarContent);
  layout.appendChild(sidebar);

  // 지도 영역
  const mapWrap = document.createElement('div');
  mapWrap.className = 'map-wrap';
  layout.appendChild(mapWrap);

  const mapEl = document.createElement('div');
  mapEl.id = 'map';
  mapWrap.appendChild(mapEl);

  // 드래그 오버레이
  const drawOverlay = document.createElement('div');
  drawOverlay.className = 'draw-overlay';
  mapWrap.appendChild(drawOverlay);

  // 힌트 텍스트 (3초 후 자동 제거)
  const hint = document.createElement('div');
  hint.className = 'map-hint';
  hint.textContent = '지도를 탭해서 그림 그리기를 시작해요';
  const hintSeen = localStorage.getItem('artrun:hint-seen');
  if (hintSeen) {
    hint.classList.add('hidden');
  } else {
    setTimeout(() => {
      hint.classList.add('hidden');
      localStorage.setItem('artrun:hint-seen', '1');
    }, 3000);
  }
  mapWrap.appendChild(hint);

  // 지도 초기화
  const map = await initMap(mapEl);

  // 상호작용 초기화
  initInteractions(map);
  initPointMode(map);
  initDragMode(map, drawOverlay);

  // 툴바
  createToolbar(mapWrap);

  // 모드 토글
  createModeToggle(mapWrap);

  // 위치 검색 (데스크톱 사이드바 상단)
  const kakaoKey = import.meta.env.VITE_KAKAO_KEY as string | undefined;
  if (kakaoKey) {
    createLocationSearch(sidebarTop, kakaoKey);
  }

  // 갤러리 (데스크톱 사이드바)
  const courses = coursesData as unknown as Course[];
  initGallery(sidebarContent, courses);

  // 코스 칩 버튼 (모바일 지도 위 플로팅, 데스크톱에서는 CSS로 숨김)
  createCourseChips(mapWrap, courses);

  // 오버레이 로드
  loadOverlay(courses);

  // 경로 애니메이션 초기화
  initRouteAnimator();

  // 상태 구독 → 지도 레이어 업데이트
  function syncMapLayers(): void {
    const { points, dragCapture } = drawStore.getState();

    // 점 마커
    updatePointsSource(points);

    // 완료된 경로
    const composed = getComposedLine(points);
    updateRouteSource(composed ? [composed] : []);

    // 펜딩 (직선 점선)
    const pendingLines = getPendingLines(points, dragCapture);
    updatePendingSource(pendingLines);

    // 에러
    const errorLines = getErrorLines(points);
    updateErrorSource(errorLines);

  }

  drawStore.subscribe(syncMapLayers);
  routeStore.subscribe(() => syncMapLayers());

  // 초기 동기화
  syncMapLayers();

  // 리사이즈 핸들러
  const resizeObserver = new ResizeObserver(() => resizeMap());
  resizeObserver.observe(mapWrap);

  // 사이드바가 열릴 때 지도 리사이즈 (MediaQuery 변화)
  window.matchMedia('(min-width: 1024px)').addEventListener('change', () => {
    setTimeout(() => resizeMap(), 10);
  });
}
