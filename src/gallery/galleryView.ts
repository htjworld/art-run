import { el } from '../util/dom';
import type { Course, CourseType } from './courses';
import { createTabs } from '../ui/tabs';
import { triggerGpxDownload } from '../gpx/export';
import { loadCourse } from './loadCourse';
import { getMap } from '../map/mapView';
import { showOnlyCourse } from '../map/overlay';
import { startRouteAnimation } from '../map/routeAnimator';

let allCourses: Course[] = [];
let onCourseSelect: ((id: string | null) => void) | null = null;

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

  for (const course of filtered) {
    container.appendChild(createCard(course));
  }
}

function createCard(course: Course): HTMLElement {
  const li = el('li', { class: 'course-card' });
  li.setAttribute('aria-label', course.name);

  // 썸네일
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
    const placeholder = el('div', { class: 'course-card__thumb-placeholder' });
    placeholder.textContent = course.type === 'artrun' ? '🎨' : '🏃';
    li.appendChild(placeholder);
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

  // 카드 클릭 → flyTo + 강조
  li.addEventListener('click', () => {
    const map = getMap();
    map.flyTo({
      center: course.center,
      zoom: course.zoom,
      duration: 1200,
      essential: true,
    });
    showOnlyCourse(course.id);
    if (course.route) startRouteAnimation(course.route);
    onCourseSelect?.(course.id);
  });

  return li;
}
