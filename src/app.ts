import './ui/styles.css';
import { initMap, updateRouteSource, updatePendingSource, updateErrorSource, updatePointsSource, resizeMap } from './map/mapView';
import { initInteractions } from './map/interactions';
import { loadOverlay } from './map/overlay';
import { initPointMode } from './draw/pointMode';
import { initDragMode } from './draw/dragMode';
import { drawStore } from './draw/drawStore';
import { routeStore, getComposedLine, getPendingLines, getErrorLines } from './draw/routeComposer';
import { setRoutingProvider } from './draw/routeComposer';
import { OrsClient } from './routing/orsClient';
import { createToolbar } from './ui/toolbar';
import { createModeToggle } from './ui/modeToggle';
import { createBottomSheet } from './ui/sheet';
import { initGallery } from './gallery/galleryView';
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
  const sidebarContent = document.createElement('div');
  sidebarContent.className = 'sidebar__content';
  sidebar.appendChild(sidebarHeader);
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

  // 힌트 텍스트
  const hint = document.createElement('div');
  hint.className = 'map-hint';
  hint.textContent = '지도를 탭해서 그림 그리기를 시작해요';
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

  // 갤러리 (사이드바 + 바텀시트 공유)
  const courses = coursesData as unknown as Course[];
  initGallery(sidebarContent, courses);

  // 오버레이 로드
  loadOverlay(courses);

  // 바텀시트 (모바일)
  const { el: sheetEl } = createBottomSheet(mapWrap);
  const sheetHeader = sheetEl.querySelector('.sheet__header') as HTMLElement;
  const sheetContent = sheetEl.querySelector('.sheet__content') as HTMLElement;
  initGallery(sheetHeader, courses);
  // sheetContent에 추가 목록 (실제로는 sheetHeader가 탭+콘텐츠를 가짐)
  // sheet 내부 구조 재정렬
  const sheetInner = document.createElement('div');
  sheetInner.style.padding = '0 4px';
  sheetContent.appendChild(sheetInner);
  initGallery(sheetInner, courses);

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

    // 힌트 표시/숨김
    hint.classList.toggle('hidden', points.length > 0);
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
