import './ui/styles.css';
import { initMap, updateRouteSource, updatePendingSource, updateErrorSource, updatePointsSource, resizeMap, flyToPoint } from './map/mapView';
import { initInteractions } from './map/interactions';
import { loadOverlay, showOnlyCourse } from './map/overlay';
import { initRouteAnimator, stopRouteAnimation } from './map/routeAnimator';
import { initPointMode } from './draw/pointMode';
import { initDragMode } from './draw/dragMode';
import { drawStore } from './draw/drawStore';
import { routeStore, getPartialLines, getPendingLines, getErrorLines, setRoutingProvider } from './draw/routeComposer';
import { OrsClient } from './routing/orsClient';
import { createToolbar } from './ui/toolbar';
import { createModeToggle } from './ui/modeToggle';
import { initGallery, clearGallerySelection, setUserLocation } from './gallery/galleryView';
import { createLocationSearch } from './ui/locationSearch';
import { createCourseChips } from './ui/courseChips';
import { showToast } from './ui/toast';
import { startLocationWatch, getLastPosition, onLocationUpdate } from './util/userLocation';
import coursesData from './gallery/courses.json';
import type { Course } from './gallery/courses';
import logoUrl from '../assets/logo.png';

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

  // 초기화 함수 — 로고 클릭 시 호출
  const DEFAULT_CENTER: [number, number] = [126.9784, 37.5665];

  function resetAll(): void {
    drawStore.clear();
    routeStore.clear();
    clearGallerySelection();
    showOnlyCourse(null);
    stopRouteAnimation();
    const pos = getLastPosition();
    const [lng, lat] = pos ?? DEFAULT_CENTER;
    flyToPoint(lng, lat, 13);
  }

  // 위치 권한 상태를 확인해 자동 시작 결정
  // - 이미 허용(granted): 즉시 watchPosition 시작 → Chrome 재방문 등 정상 동작
  // - 허용 전(prompt): 자동 요청하지 않음 → 사용자가 locate 버튼 클릭 후 허용 시 change 이벤트로 시작
  // - Safari 등 permissions API 미지원: 조용히 skip
  if (navigator.permissions) {
    navigator.permissions.query({ name: 'geolocation' as PermissionName })
      .then(result => {
        function tryStart(): void {
          if (result.state === 'granted') {
            startLocationWatch();
            onLocationUpdate((lng, lat) => setUserLocation(lng, lat));
          }
        }
        tryStart();
        result.addEventListener('change', tryStart);
      })
      .catch(() => {});
  }

  // 타이틀바 (모바일)
  const titlebar = document.createElement('div');
  titlebar.className = 'titlebar';
  const titlebarLogo = document.createElement('img');
  titlebarLogo.src = logoUrl;
  titlebarLogo.alt = 'ArtRun 홈으로';
  titlebarLogo.className = 'logo-btn';
  titlebarLogo.setAttribute('role', 'button');
  titlebarLogo.setAttribute('tabindex', '0');
  titlebarLogo.setAttribute('aria-label', '홈으로 — 모든 그리기 초기화');
  titlebarLogo.addEventListener('click', resetAll);
  titlebarLogo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') resetAll(); });
  titlebar.appendChild(titlebarLogo);
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
  const sidebarLogo = document.createElement('img');
  sidebarLogo.src = logoUrl;
  sidebarLogo.alt = 'ArtRun 홈으로';
  sidebarLogo.className = 'logo-btn';
  sidebarLogo.setAttribute('role', 'button');
  sidebarLogo.setAttribute('tabindex', '0');
  sidebarLogo.setAttribute('aria-label', '홈으로 — 모든 그리기 초기화');
  sidebarLogo.addEventListener('click', resetAll);
  sidebarLogo.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') resetAll(); });
  sidebarHeader.appendChild(sidebarLogo);
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

    // 완료된 경로 (부분 완성 포함 — ORS 계산 중에도 기존 구간 유지)
    updateRouteSource(getPartialLines(points));

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
