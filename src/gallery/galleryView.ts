import { el } from '../util/dom';
import type { Course, CourseType } from './courses';
import { createTabs } from '../ui/tabs';
import { triggerGpxDownload } from '../gpx/export';
import { loadCourse } from './loadCourse';
import { flyToCourse } from '../map/mapView';
import { showOnlyCourse } from '../map/overlay';
import { startRouteAnimation, stopRouteAnimation } from '../map/routeAnimator';

let allCourses: Course[] = [];
let onCourseSelect: ((id: string | null) => void) | null = null;
let selectedId: string | null = null;
let userPos: [number, number] | null = null; // [lng, lat]

function distKmTo(course: Course): number {
  if (!userPos) return Infinity;
  const [ux, uy] = userPos;
  const [cx, cy] = course.center;
  const dx = (cx - ux) * Math.cos((uy * Math.PI) / 180);
  const dy = cy - uy;
  return Math.sqrt(dx * dx + dy * dy) * 111.32;
}

function sortedByDistance(courses: Course[]): Course[] {
  if (!userPos) return courses;
  return [...courses].sort((a, b) => distKmTo(a) - distKmTo(b));
}

export function initGallery(
  container: HTMLElement,
  courses: Course[],
  onSelect?: (id: string | null) => void
): void {
  allCourses = courses;
  onCourseSelect = onSelect ?? null;

  const artrun = courses.filter(c => c.type === 'artrun');
  const scenic = courses.filter(c => c.type === 'scenic');

  const { setActive } = createTabs(container, {
    counts: { artrun: artrun.length, scenic: scenic.length },
    onTabChange(type) {
      setActive(type);
      renderList(listContainer, type);
    },
  });

  const listContainer = el('ul', {
    class: 'course-list',
    'aria-label': '코스 목록',
  });
  container.appendChild(listContainer);

  setActive('artrun');
  renderList(listContainer, 'artrun');

  // 위치 권한 요청 → 가져오면 현재 탭 재정렬
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(pos => {
      userPos = [pos.coords.longitude, pos.coords.latitude];
      // 현재 보이는 탭 재렌더
      const activeTab = (container.querySelector('.tabs__btn.active') as HTMLElement | null)
        ?.dataset.tab as CourseType | undefined;
      renderList(listContainer, activeTab ?? 'artrun');
    }, () => { /* 거부 시 기본 순서 유지 */ }, { timeout: 5000 });
  }
}

function renderList(container: HTMLElement, type: CourseType): void {
  container.innerHTML = '';
  const filtered = allCourses.filter(c => c.type === type);

  if (filtered.length === 0) {
    const empty = el('li', {});
    empty.innerHTML = '<p style="padding:20px;text-align:center;color:var(--muted);font-size:13px;">코스를 준비 중이에요.</p>';
    container.appendChild(empty);
    return;
  }

  const sorted = sortedByDistance(filtered);
  for (const course of sorted) {
    container.appendChild(createCard(course));
  }
}

function createRouteSvg(coords: [number, number][]): SVGSVGElement {
  const W = 300, H = 96, PAD = 10;

  const lngs = coords.map(c => c[0]);
  const lats = coords.map(c => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats), maxLat = Math.max(...lats);
  const spanLng = maxLng - minLng || 1;
  const spanLat = maxLat - minLat || 1;

  // 비율 유지하며 맞춤
  const scaleX = (W - PAD * 2) / spanLng;
  const scaleY = (H - PAD * 2) / spanLat;
  const scale = Math.min(scaleX, scaleY);
  const offX = (W - spanLng * scale) / 2;
  const offY = (H - spanLat * scale) / 2;

  const pts = coords
    .map(([lng, lat]) => [
      offX + (lng - minLng) * scale,
      H - (offY + (lat - minLat) * scale), // lat 반전
    ])
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(' ');

  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', 'course-card__route-svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('aria-hidden', 'true');

  const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
  polyline.setAttribute('points', pts);
  polyline.setAttribute('fill', 'none');
  polyline.setAttribute('stroke', '#242424');
  polyline.setAttribute('stroke-width', '2.5');
  polyline.setAttribute('stroke-linecap', 'round');
  polyline.setAttribute('stroke-linejoin', 'round');

  svg.appendChild(polyline);
  return svg as unknown as SVGSVGElement;
}

function createCard(course: Course): HTMLElement {
  const li = el('li', { class: 'course-card' });
  li.setAttribute('aria-label', course.name);

  // 썸네일 or 경로 SVG 미리보기
  if (course.thumbnail) {
    const img = el('img', {
      class: 'course-card__thumb',
      src: course.thumbnail,
      alt: course.name,
      loading: 'lazy',
      decoding: 'async',
      width: '300',
      height: '96',
    });
    li.appendChild(img);
  } else {
    const route = course.routeSimplified ?? course.route;
    if (route && route.coordinates.length >= 2) {
      li.appendChild(createRouteSvg(route.coordinates as [number, number][]));
    }
  }

  const body = el('div', { class: 'course-card__body' });

  const name = el('div', { class: 'course-card__name' }, course.name);
  const meta = el(
    'div',
    { class: 'course-card__meta' },
    `${course.distanceKm.toFixed(1)}km · ${course.region}`
  );
  const desc = el('div', { class: 'course-card__desc' }, course.description);

  const actions = el('div', { class: 'course-card__actions' });

  const editBtn = el('button', {
    class: 'btn btn--secondary btn--sm',
    'aria-label': `${course.name} 편집하기`,
  }) as HTMLButtonElement;
  editBtn.textContent = '편집하기';

  const gpxBtn = el('button', {
    class: 'btn btn--primary btn--sm',
    'aria-label': `${course.name} GPX 저장`,
  }) as HTMLButtonElement;
  gpxBtn.textContent = 'GPX 저장';

  if (!course.route) gpxBtn.disabled = true;

  editBtn.addEventListener('click', e => {
    e.stopPropagation();
    loadCourse(course);
  });

  gpxBtn.addEventListener('click', e => {
    e.stopPropagation();
    if (!course.route) return;
    void triggerGpxDownload(course.route, course.name, true);
  });

  actions.appendChild(editBtn);
  actions.appendChild(gpxBtn);

  body.appendChild(name);
  body.appendChild(meta);
  body.appendChild(desc);
  body.appendChild(actions);
  li.appendChild(body);

  li.addEventListener('click', () => {
    if (selectedId === course.id) {
      selectedId = null;
      showOnlyCourse(null);
      stopRouteAnimation();
      li.classList.remove('active');
      onCourseSelect?.(null);
    } else {
      document.querySelectorAll('.course-card.active').forEach(el => el.classList.remove('active'));
      selectedId = course.id;
      li.classList.add('active');
      flyToCourse(course);
      showOnlyCourse(course.id);
      if (course.route) startRouteAnimation(course.route);
      onCourseSelect?.(course.id);
    }
  });

  return li;
}
