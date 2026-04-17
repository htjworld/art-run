import { el } from '../util/dom';
import type { Course, CourseType } from '../gallery/courses';
import { showOnlyCourse } from '../map/overlay';
import { getMap } from '../map/mapView';

let selectedId: string | null = null;
let activeTab: CourseType = 'artrun';
let allCourses: Course[] = [];
let chipsListEl: HTMLElement | null = null;

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

  renderChips('artrun');
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
  } else {
    selectedId = course.id;
    showOnlyCourse(course.id);
    map.flyTo({ center: course.center, zoom: course.zoom, duration: 1200, essential: true });
  }

  renderChips(activeTab);
}
