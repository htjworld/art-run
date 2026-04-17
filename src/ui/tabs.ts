import { el } from '../util/dom';
import type { CourseType } from '../gallery/courses';

interface TabsOptions {
  onTabChange: (type: CourseType) => void;
  counts: Record<CourseType, number>;
}

export function createTabs(
  container: HTMLElement,
  { onTabChange, counts }: TabsOptions
): { setActive: (type: CourseType) => void } {
  const tabBar = el('div', { class: 'tabs', role: 'tablist', 'aria-label': '코스 유형' });

  const defs: { id: CourseType; label: string }[] = [
    { id: 'artrun', label: '인기 아트런' },
    { id: 'scenic', label: '인기 코스' },
  ];

  const buttons = new Map<CourseType, HTMLButtonElement>();

  for (const { id, label } of defs) {
    const btn = el('button', {
      class: 'tabs__btn',
      role: 'tab',
      'aria-selected': 'false',
      'data-tab': id,
    }) as HTMLButtonElement;
    btn.textContent = `${label} (${counts[id]})`;
    btn.addEventListener('click', () => {
      setActive(id);
      onTabChange(id);
    });
    tabBar.appendChild(btn);
    buttons.set(id, btn);
  }

  function setActive(type: CourseType): void {
    buttons.forEach((btn, t) => {
      btn.classList.toggle('active', t === type);
      btn.setAttribute('aria-selected', String(t === type));
    });
  }

  container.appendChild(tabBar);
  return { setActive };
}
