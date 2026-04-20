import { el } from '../util/dom';
import type { Course, CourseType } from '../gallery/courses';
import { showOnlyCourse } from '../map/overlay';
import { getMap } from '../map/mapView';
import { triggerGpxDownload } from '../gpx/export';

let selectedId: string | null = null;
let activeTab: CourseType = 'artrun';
let allCourses: Course[] = [];
let chipsListEl: HTMLElement | null = null;
let infoPanelEl: HTMLElement | null = null;

export function createCourseChips(container: HTMLElement, courses: Course[]): void {
  allCourses = courses;

  const panel = el('div', { class: 'chips-panel' });

  // 탭
  const tabBar = el('div', { class: 'chips-tabbar' });
  const artrunTab = el('button', { class: 'chips-tab active', 'data-type': 'artrun' }, '아트런');
  const scenicTab = el('button', { class: 'chips-tab', 'data-type': 'scenic' }, '인기 코스');

  artrunTab.addEventListener('click', () => switchTab('artrun', artrunTab, scenicTab));
  scenicTab.addEventListener('click', () => switchTab('scenic', scenicTab, artrunTab));

  tabBar.appendChild(artrunTab);
  tabBar.appendChild(scenicTab);

  // 칩 목록
  const chipsList = el('div', { class: 'chips-list' });
  chipsListEl = chipsList;

  panel.appendChild(tabBar);
  panel.appendChild(chipsList);
  container.appendChild(panel);

  // 코스 정보 패널
  infoPanelEl = createInfoPanel();
  container.appendChild(infoPanelEl);

  renderChips('artrun');
}

function createInfoPanel(): HTMLElement {
  const panel = el('div', { class: 'course-info-panel', role: 'region', 'aria-label': '선택한 코스 정보' });

  const nameEl = el('div', { class: 'course-info__name' });
  const metaEl = el('div', { class: 'course-info__meta' });
  const gpxBtn = el('button', {
    class: 'btn btn--primary btn--sm course-info__gpx',
    'aria-label': 'GPX 다운로드',
  }) as HTMLButtonElement;
  gpxBtn.textContent = '⬇ GPX 다운로드';

  panel.appendChild(nameEl);
  panel.appendChild(metaEl);
  panel.appendChild(gpxBtn);

  return panel;
}

function showInfoPanel(course: Course): void {
  if (!infoPanelEl) return;
  const nameEl = infoPanelEl.querySelector('.course-info__name') as HTMLElement;
  const metaEl = infoPanelEl.querySelector('.course-info__meta') as HTMLElement;
  const gpxBtn = infoPanelEl.querySelector('.course-info__gpx') as HTMLButtonElement;

  nameEl.textContent = course.name;
  metaEl.textContent = `${course.distanceKm.toFixed(1)}km · ${course.region}`;
  gpxBtn.disabled = !course.route;

  gpxBtn.onclick = () => {
    if (course.route) void triggerGpxDownload(course.route, course.name, true);
  };

  infoPanelEl.classList.add('visible');
}

function hideInfoPanel(): void {
  infoPanelEl?.classList.remove('visible');
}

function switchTab(type: CourseType, on: HTMLElement, off: HTMLElement): void {
  activeTab = type;
  on.classList.add('active');
  off.classList.remove('active');
  renderChips(type);
}

function renderChips(type: CourseType): void {
  if (!chipsListEl) return;
  chipsListEl.innerHTML = '';

  const filtered = allCourses.filter(c => c.type === type);
  for (const course of filtered) {
    const chip = el('button', {
      class: `course-chip${selectedId === course.id ? ' active' : ''}`,
      'aria-pressed': String(selectedId === course.id),
      'aria-label': course.name,
    }, course.name);

    chip.addEventListener('click', () => toggleCourse(course));
    chipsListEl.appendChild(chip);
  }
}

function toggleCourse(course: Course): void {
  const map = getMap();

  if (selectedId === course.id) {
    selectedId = null;
    showOnlyCourse(null);
    hideInfoPanel();
  } else {
    selectedId = course.id;
    showOnlyCourse(course.id);
    showInfoPanel(course);
    map.flyTo({ center: course.center, zoom: course.zoom, duration: 1200, essential: true });
  }

  renderChips(activeTab);
}
